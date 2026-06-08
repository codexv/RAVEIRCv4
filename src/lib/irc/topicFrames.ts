// Decorative channel-topic frames — a native port of RAVE's rv.topic.* designs.
//
// The original RAVE (RAVE-NET) carried ~27 "topic design" aliases that wrapped
// operator-entered text in ASCII / mIRC-colour art frames. The pure-Unicode
// frames port verbatim; the colour-code frames in the original relied on raw
// Ctrl+K (\x03) bytes whose exact positions aren't recoverable from the source,
// so a couple of clean colour frames are authored here instead.

const K = "\x03"; // mIRC colour control byte (Ctrl+K)

export interface TopicFrame {
  id: string;
  /** Short human label for pickers/listings. */
  label: string;
  /** Wrap the given text in this frame. `{}` in the template is the text slot. */
  template: string;
}

export const TOPIC_FRAMES: TopicFrame[] = [
  { id: "d1", label: "section", template: "°~`~*¤§ƒ  {} ƒ§¤*~`~°" },
  { id: "d2", label: "waves", template: "©º°¨¨°º© {} ©º°¨¨°º©" },
  { id: "d3", label: "waves-2x", template: "©º°¨¨°º©©º°¨¨°º©  {} ©º°¨¨°º©©º°¨¨°º©" },
  { id: "d4", label: "arrows-in", template: "(¯`·._(¯`·._(¯`·._( {} )_.·´¯)_.·´¯)_.·´¯)" },
  { id: "d5", label: "swoosh", template: ".(¯`·.¸(¯`·.¸(¯`·.¸(¯`·.¸ {} ¸.·´¯)¸.·´¯)¸.·´¯)¸.·´¯)" },
  { id: "d6", label: "swoosh-arrow", template: "(¯`·.¸¸.·´¯`·.¸¸.-> {} <-.¸¸.·´¯`·.¸¸.·´¯)" },
  { id: "d7", label: "ribbon", template: "¯°·.¸¸.·°¯°·.¸¸.·°¯°·.¸¸.-> {} <-.¸¸.·°¯°·.¸¸.·°¯°·.¸¸.·°¯" },
  { id: "d8", label: "stardust", template: ".,-*-,._.,-*'^'~*-,._.,-*~> {} <~*-,._.,-*~'^'~*-,._.,-*-,." },
  { id: "d9", label: "lattice", template: "|!¤*'~``~'*¤!||!¤*'~``~'*¤!| {} |!¤*'~``~'*¤!||!¤*'~``~'*¤!|" },
  { id: "d10", label: "equals", template: "§¤*~`~*¤§|§¤*~`~*¤§|§¤*~ -==- {} -==- ~*¤§|§¤*~`~*¤§|§¤*~`~*¤§" },
  { id: "welcome", label: "welcome (uses channel name)", template: "©º°¨¨°º©©º°¨¨°º© Welcome to {} ©º°¨¨°º©©º°¨¨°º©" },
  // Authored clean colour frames (correct \x03 codes).
  { id: "c1", label: "colour bars", template: `${K}4,1»${K}8,1»${K}3,1» {} ${K}3,1«${K}8,1«${K}4,1«` },
  { id: "c2", label: "colour diamonds", template: `${K}12,1¤${K}11,1¤${K}0,1 {} ${K}11,1¤${K}12,1¤` },
];

const BY_ID = new Map(TOPIC_FRAMES.map((f) => [f.id, f]));

export function getFrame(id: string): TopicFrame | undefined {
  return BY_ID.get(id.toLowerCase());
}

/** Apply a frame to the given text; returns the framed topic string. */
export function applyFrame(frame: TopicFrame, text: string): string {
  return frame.template.replace("{}", text);
}
