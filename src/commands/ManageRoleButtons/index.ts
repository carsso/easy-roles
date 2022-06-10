import { APIActionRowComponent, APIEmbed, APIMessageActionRowComponent, ComponentType } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  Button,
  ButtonBuilder,
  ButtonContext,
  EmbedBuilder,
  IMessageCommand,
  MessageBuilder,
  MessageCommandBuilder,
  MessageCommandContext,
  PermissionBits
} from "interactions.ts";
import { stringifyEmoji } from "../../util/stringify-emoji";
import { CreateRoleButtonButtons } from "./create-button";
import { DeleteRoleButtonButtons } from "./delete-button";
import { EditMenu } from "./edit-menu";

type RefreshState = { messageId: string; authorId: string; embed: APIEmbed };

export class ManageRoleButtons implements IMessageCommand {
  public builder = new MessageCommandBuilder("Manage Role Buttons")
    .setDMEnabled(false)
    .addRequiredPermissions(PermissionBits.ADMINISTRATOR);

  public handler = async (ctx: MessageCommandContext): Promise<void> => {
    return ctx.reply(await buildMessageRoleButtonMenu(ctx));
  };

  public components = [
    new Button(
      "refresh",
      new ButtonBuilder().setEmoji({ name: "🔄" }).setStyle(2),
      async (ctx: ButtonContext<RefreshState>): Promise<void> => {
        return ctx.reply(await buildMessageRoleButtonMenu(ctx));
      }
    ),
    ...EditMenu,
    ...CreateRoleButtonButtons,
    ...DeleteRoleButtonButtons
  ];
}

async function buildMessageRoleButtonMenu(
  ctx: MessageCommandContext | ButtonContext<RefreshState>
): Promise<MessageBuilder> {
  let messageId: string, authorId: string, originalEmbed: APIEmbed;

  if (ctx instanceof MessageCommandContext) {
    messageId = Object.keys(ctx.interaction.data.resolved.messages)[0] as string;

    const message = ctx.interaction.data.resolved.messages[messageId];

    authorId = message.author.id;
    originalEmbed = message.embeds[0];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    messageId = ctx.state!.messageId;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    authorId = ctx.state!.authorId;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    originalEmbed = ctx.state!.embed;
  }

  if (!ctx.webhook || ctx.webhook.id !== authorId) {
    return new MessageBuilder()
      .setEphemeral(true)
      .setContent("You can only use this command on messages sent through the bot.");
  }

  const embed = new EmbedBuilder().setTitle("Role Buttons");
  let description = "";

  const message = ctx.webhook.messages.get(messageId);

  if (!message) {
    return new MessageBuilder().setEphemeral(true).setContent("Message not found.");
  }

  const components: APIActionRowComponent<APIMessageActionRowComponent>[] = message.components
    ? JSON.parse(message.components)
    : [];

  for (const actionRow of components) {
    for (const component of actionRow.components) {
      if (component.type === ComponentType.Button) {
        const customId = (component as { custom_id: string }).custom_id ?? "";
        const roleId = JSON.parse(customId.split("|")[1]).roleId as string;

        if (!roleId) continue;

        const emoji = `${component.emoji ? stringifyEmoji(component.emoji) : ""}`;

        description += `${
          component.label ? `\`\`${component.label}${emoji}\`\`` : `\`\`${emoji}\`\``
        } - <@&${roleId}>\n`;
      }
    }
  }

  if (description === "") {
    description =
      "No role buttons found. Create one first using the ``/create-role-button`` command or the menu below.";
  }

  embed.setDescription(description);

  return new MessageBuilder(embed)
    .setEphemeral(true)
    .addComponents(
      new ActionRowBuilder([
        await ctx.createComponent("refresh", { messageId, authorId, embed: originalEmbed }),
        await ctx.createComponent("editMenuButton", { parentId: messageId, embed: originalEmbed })
      ]),
      new ActionRowBuilder([
        await ctx.createComponent("createRoleButton", { parentId: messageId }),
        await ctx.createComponent("removeRoleButton", { parentId: messageId })
      ])
    );
}
