import { APIMessageComponentEmoji } from "discord-api-types/v10";

export function stringifyEmoji(emoji: APIMessageComponentEmoji) {
  if (emoji.id) {
    return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
  } else {
    return emoji.name;
  }
}
