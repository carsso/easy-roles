import { APIMessageComponentEmoji, ComponentType } from "discord-api-types/v10";
import {
  EmbedBuilder,
  IMessageCommand,
  MessageBuilder,
  MessageCommandBuilder,
  MessageCommandContext
} from "interactions.ts";

export class ManageRoleButtons implements IMessageCommand {
  public builder = new MessageCommandBuilder("Manage Role Buttons");

  public handler = async (ctx: MessageCommandContext): Promise<void> => {
    return ctx.reply(buildMessageRoleButtonMenu(ctx));
  };
}

function buildMessageRoleButtonMenu(ctx: MessageCommandContext): MessageBuilder {
  const messageId = Object.keys(ctx.interaction.data.resolved.messages)[0] as string,
    message = ctx.interaction.data.resolved.messages[messageId];

  const webhook = ctx.db.webhooks.find((webhook) => webhook.id === message.author.id);

  if (!webhook) {
    return new MessageBuilder()
      .setEphemeral(true)
      .setContent("You can only use this command on messages sent by one of your webhooks.");
  }

  const embed = new EmbedBuilder().setTitle("Role Buttons");

  let description = "";

  for (const actionRow of message.components ?? []) {
    for (const component of actionRow.components) {
      if (component.type === ComponentType.Button) {
        const customId = (component as { custom_id: string }).custom_id ?? "";
        const roleId = JSON.parse(customId.split("|")[1])._id as string;

        if (!roleId) continue;

        const emoji = `${component.emoji ? stringifyEmoji(component.emoji) : ""}`;

        description += `${component.label ? `${component.label}${emoji}` : `${emoji}`} - <@&${roleId}>\n`;
      }
    }
  }

  if (description === "") {
    description = "No role buttons found. Create one first using the ``/create-role-button`` command.";
  }

  embed.setDescription(description);

  return new MessageBuilder(embed).setEphemeral(true);
}

async function stringifyEmoji(emoji: APIMessageComponentEmoji) {
  if (emoji.id) {
    return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
  } else {
    return emoji.name;
  }
}
