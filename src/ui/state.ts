// Shared UI/game controller flags, kept tiny so scenes and UI can both import it.
export const game = {
  playing: false,
  modal: false,
  dialog: false,
  blocked(): boolean { return this.modal || this.dialog; },
  pollInput: () => { /* set by input */ },
  sceneReady: () => { /* set by main */ },
  afterFrame: () => { /* set by hud */ },
};
