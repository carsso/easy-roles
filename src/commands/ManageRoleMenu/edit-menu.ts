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

    const modal = await ctx.createComponent<ModalBuilder>("editMenuModal", {
      parentId: ctx.state.parentId,
      embed
    });

    const title = new TextInputBuilder("title", "Title", TextInputStyle.Short).setMaxLength(80).setRequired(false);

    if (ctx.state.embed?.title) title.setValue(ctx.state.embed.title);

    const description = new TextInputBuilder("description", "Description", TextInputStyle.Paragraph)
      .setPlaceholder("Tip: You can make clickable text [like this!](https://discord.com)")
      .setMaxLength(4000)
      .setRequired(false);

    if (ctx.state.embed?.description) description.setValue(ctx.state.embed.description);

    const image = new TextInputBuilder("image", "Image", TextInputStyle.Short)
      .setPlaceholder("A link to an image.")
      .setMaxLength(2000)
      .setRequired(false);

    if (ctx.state.embed?.image?.url) image.setValue(ctx.state.embed?.image?.url);

    const colour = new TextInputBuilder("colour", "Colour", TextInputStyle.Paragraph)
      .setPlaceholder("A hex colour code, as used in roles. (e.g. #36adcf)")
      .setMaxLength(7)
      .setRequired(false);

    if (ctx.state.embed?.color) colour.setValue(`#${ctx.state.embed?.color?.toString(16)}`);

    modal.addComponents(
      new ActionRowBuilder([title]),
      new ActionRowBuilder([description]),
      new ActionRowBuilder([image]),
      new ActionRowBuilder([colour])
    );

    return ctx.reply(modal);
  }
);

const EditMenuModal = new Modal(
  "editMenuModal",
  new ModalBuilder().setTitle("Edit your Menu"),
  async (ctx: ModalSubmitContext<State>): Promise<void> => {
    if (!ctx.state) return ctx.defer();

    if (!ctx.webhook) {
      return ctx.reply(SimpleError("Webhook not found.").setEphemeral(true));
    }

    const webhook = new InteractionWebhook(ctx.webhook.id, ctx.webhook.token);

    const embed = new EmbedBuilder();

    const title = ctx.components.get("title");
    const description = ctx.components.get("description");

    if (!title?.value && !description?.value)
      return ctx.reply(SimpleError("Either a title or description is required."));

    if (title?.value) embed.setTitle(title.value);
    if (description?.value) embed.setDescription(description.value);

    const colour = ctx.components.get("colour");
    const image = ctx.components.get("image");

    if (colour?.value) {
      if (!/#[0-9a-fA-F]{6}/.test(colour.value)) {
        return ctx.reply(
          SimpleError("Invalid colour. You must enter a hex colour code such as #36adcf.").setEphemeral(true)
        );
      }

      embed.setColor(parseInt(colour.value.substring(1), 16));
    }

    if (image?.value) embed.setImage(image.value);

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
