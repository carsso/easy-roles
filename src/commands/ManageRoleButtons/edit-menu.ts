import { APIEmbed } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  Button,
  ButtonBuilder,
  ButtonContext,
  ButtonStyle,
  EmbedBuilder,
  InteractionWebhook,
  MessageBuilder,
  Modal,
  ModalBuilder,
  ModalSubmitContext,
  SimpleEmbed,
  SimpleError,
  TextInputBuilder,
  TextInputStyle
} from "interactions.ts";

type State = {
  parentId: string;
  embed: APIEmbed;
};

const EditMenuButton = new Button(
  "editMenuButton",
  new ButtonBuilder(ButtonStyle.Primary, "Edit").setEmoji({ name: "🖋" }),
  async (ctx: ButtonContext<State>) => {
    if (!ctx.state) return;

    const embed = ctx.state.embed;

    console.dir(ctx.state, { depth: 5 });

    const modal = await ctx.createComponent<ModalBuilder>("editMenuModal", {
      parentId: ctx.state.parentId,
      embed
    });

    modal.addComponents(
      new ActionRowBuilder([
        new TextInputBuilder("title", "Title", TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
          .setValue(embed?.title ?? "No title.")
      ]),
      new ActionRowBuilder([
        new TextInputBuilder("description", "Description", TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000)
          .setValue(embed?.description ?? "No description.")
      ])
    );

    return ctx.reply(modal);
  }
);

const EditMenuModal = new Modal(
  "editMenuModal",
  new ModalBuilder().setTitle("Edit your Menu"),
  async (ctx: ModalSubmitContext<State>): Promise<void> => {
    if (!ctx.state) throw new Error("State is undefined");

    if (!ctx.webhook) {
      return ctx.reply(SimpleError("Webhook not found.").setEphemeral(true));
    }

    const webhook = new InteractionWebhook(ctx.webhook.id, ctx.webhook.token);
    const embed = new EmbedBuilder(ctx.state.embed);

    const title = ctx.components.get("title")?.value;
    const description = ctx.components.get("description")?.value;

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);

    try {
      await webhook.edit(new MessageBuilder(embed), ctx.state.parentId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      switch (err.code as number) {
        case 10008: {
          await ctx.reply(
            SimpleError(
              `I can't find this message, please ensure it hasn't been deleted and that the bot has access to view the channel.`
            ).setEphemeral(true)
          );
          break;
        }
        case 10015: {
          await ctx.reply(
            SimpleError(
              `The webhook for this channel seems to have been deleted. This isn't recommended as you'll no longer be able to edit previously created menus, although their buttons will still function.\n\nTo continue, you'll have to create a new menu with \`\`/create-menu\`\`.`
            ).setEphemeral(true)
          );

          await ctx.db.updateOne({
            $unset: {
              [`webhooks.${ctx.webhook.channelId}`]: ""
            }
          });
          break;
        }
        default: {
          console.error(err);
          await ctx.reply(
            SimpleError("An unknown error occurred while updating your message.").setEphemeral(true).setComponents([])
          );
          break;
        }
      }

      return;
    }

    return ctx.reply(SimpleEmbed("Menu Updated!").setComponents([]).setEphemeral(true));
  }
);

export const EditMenu = [EditMenuButton, EditMenuModal];
