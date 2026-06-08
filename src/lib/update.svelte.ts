// In-app auto-updater: checks GitHub Releases for a newer signed build,
// downloads it, and relaunches to apply — no manual reinstall/close.
// Safe in dev/before any release: a failed check just goes quiet.

import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Status = "idle" | "checking" | "available" | "downloading" | "ready" | "none" | "error";

class Updater {
  status = $state<Status>("idle");
  version = $state("");
  notes = $state("");
  error = $state("");
  progress = $state(0);
  private pending: Update | null = null;

  /** Check for an update. `manual` surfaces "up to date"/errors; auto stays quiet. */
  async check(manual = false) {
    if (this.status === "checking" || this.status === "downloading") return;
    this.status = "checking";
    this.error = "";
    try {
      const upd = await check();
      if (upd) {
        this.pending = upd;
        this.version = upd.version;
        this.notes = upd.body ?? "";
        this.status = "available";
      } else {
        this.status = manual ? "none" : "idle";
      }
    } catch (e) {
      // Dev builds / no releases yet / offline → don't nag unless asked.
      this.error = String(e);
      this.status = manual ? "error" : "idle";
    }
  }

  /** Download + install the pending update, then relaunch. */
  async installAndRestart() {
    if (!this.pending) return;
    this.status = "downloading";
    this.progress = 0;
    let total = 0;
    let got = 0;
    try {
      await this.pending.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        else if (ev.event === "Progress") {
          got += ev.data.chunkLength;
          this.progress = total ? Math.round((got / total) * 100) : 0;
        } else if (ev.event === "Finished") {
          this.progress = 100;
        }
      });
      this.status = "ready";
      await relaunch();
    } catch (e) {
      this.error = String(e);
      this.status = "error";
    }
  }

  dismiss() {
    if (this.status !== "downloading") this.status = "idle";
  }
}

export const updater = new Updater();
