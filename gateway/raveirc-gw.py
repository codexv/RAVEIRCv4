#!/usr/bin/env python3
"""RAVEIRC WebSocket <-> IRC gateway.

Browsers can't open raw TCP, so the PWA at raveirc.coders.ch/chat connects here
over WSS; this bridges to the chosen IRC server (TCP/TLS) and pipes raw IRC
lines both ways, one line per WebSocket text frame.

Target is chosen by the client via the query string:
    wss://host/gw?host=irc.libera.chat&port=6697&tls=1

Safety: only well-known IRC ports are allowed and the target must resolve to a
public address (basic anti-SSRF — this is a public proxy otherwise).
"""

import asyncio
import ipaddress
import os
import socket
import ssl
import urllib.parse

import websockets

LISTEN_HOST = os.environ.get("GW_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("GW_PORT", "8099"))

# Allowed IRC ports (anti-abuse): the usual plaintext/TLS ranges + a few extras.
ALLOWED_PORTS = set(range(6660, 7001)) | {7070, 7777, 9999}

MAX_LINE = 8192  # bytes; ignore absurdly long frames


def target_is_public(host: str) -> bool:
    """True only if every resolved address for host is a public IP."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    if not infos:
        return False
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return False
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        ):
            return False
    return True


def parse_target(path: str):
    """Pull host/port/tls out of the WS request path's query string."""
    q = urllib.parse.urlparse(path).query
    params = urllib.parse.parse_qs(q)
    host = (params.get("host") or [""])[0].strip()
    try:
        port = int((params.get("port") or ["6697"])[0])
    except ValueError:
        port = 0
    tls = (params.get("tls") or ["1"])[0].lower() not in ("0", "false", "no")
    return host, port, tls


async def handle(ws, path=None):
    # websockets >=12 passes one arg (use ws.request.path); <=11 passes (ws, path).
    if path is None:
        path = getattr(getattr(ws, "request", None), "path", "") or ""
    host, port, tls = parse_target(path)

    if not host or port not in ALLOWED_PORTS or not target_is_public(host):
        await ws.close(code=1008, reason="invalid target")
        return

    try:
        if tls:
            ctx = ssl.create_default_context()
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port, ssl=ctx, server_hostname=host), timeout=20
            )
        else:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=20
            )
    except Exception:
        await ws.close(code=1011, reason="connect failed")
        return

    async def tcp_to_ws():
        try:
            while True:
                line = await reader.readline()
                if not line:
                    break
                await ws.send(line.decode("utf-8", "replace").rstrip("\r\n"))
        except Exception:
            pass
        finally:
            try:
                await ws.close()
            except Exception:
                pass

    async def ws_to_tcp():
        try:
            async for msg in ws:
                if isinstance(msg, bytes):
                    msg = msg.decode("utf-8", "replace")
                if len(msg) > MAX_LINE:
                    continue
                for raw in msg.split("\n"):
                    raw = raw.rstrip("\r")
                    if raw:
                        writer.write((raw + "\r\n").encode("utf-8"))
                await writer.drain()
        except Exception:
            pass
        finally:
            try:
                writer.close()
            except Exception:
                pass

    await asyncio.gather(tcp_to_ws(), ws_to_tcp())


async def main():
    async with websockets.serve(
        handle, LISTEN_HOST, LISTEN_PORT, ping_interval=30, ping_timeout=30, max_size=MAX_LINE
    ):
        print(f"raveirc-gw listening on {LISTEN_HOST}:{LISTEN_PORT}", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
