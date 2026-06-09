# RAVEIRC WebSocket↔IRC gateway

Lets the browser PWA (raveirc.coders.ph/chat) reach IRC, since browsers can't
open raw TCP. Bridges WSS → IRC TCP/TLS, one IRC line per WS text frame.

Client connects with the target in the query string:

    wss://raveirc.coders.ph/gw?host=irc.libera.chat&port=6697&tls=1

## Deploy (droplet, Ubuntu)
- Code: `/opt/raveirc-gw/raveirc-gw.py` in a venv with `websockets`.
- Service: `raveirc-gw.service` (systemd) on 127.0.0.1:8099.
- Caddy: `@gw path /gw` → `reverse_proxy 127.0.0.1:8099` in the raveirc.coders.ph block (Caddy handles the WS upgrade + TLS).

Safety: only well-known IRC ports allowed; target must resolve to a public IP
(basic anti-SSRF). Note: connections originate from the droplet's IP, so
networks that block datacenter IPs or require SASL will reject them.
