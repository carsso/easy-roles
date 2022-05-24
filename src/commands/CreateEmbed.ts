import { APIWebhook } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  InteractionWebhook,
  ISlashCommand,
  Modal,
  ModalBuilder,
  ModalSubmitContext,
  PermissionBits,
  SimpleEmbed,
  SimpleError,
  SlashCommandBuilder,
  SlashCommandContext,
  TextInputBuilder,
  TextInputStyle
} from "interactions.ts";
import AvatarData from "../assets/avatar";

type State = {
  channelId: string;
};

export class CreateEmbed implements ISlashCommand {
  public builder = new SlashCommandBuilder("create-embed", "Create an embed for the bot to post.")
    .setDMEnabled(false)
    .addRequiredPermissions(PermissionBits.ADMINISTRATOR);

  public handler = async (ctx: SlashCommandContext): Promise<void> => {
    if (!ctx.db.webhooks.find((w) => w.channelId === ctx.interaction.channel_id)) {
      if (ctx.db.webhooks.length === 3)
        return ctx.reply(SimpleError("You can only have 3 webhooks for now.").setEphemeral(true));

      return ctx.reply(await ctx.createComponent<ModalBuilder>("createWebhookAndEmbed"));
    }

    return ctx.reply(await ctx.createComponent<ModalBuilder>("createEmbed"));
  };

  public components = [
    new Modal(
      "createWebhookAndEmbed",
      new ModalBuilder()
        .addComponents(
          new ActionRowBuilder([
            new TextInputBuilder("name", "Webhook Name", TextInputStyle.Short).setPlaceholder(
              "A name for the webhook through which the role menu will be created."
            )
          ]),
          new ActionRowBuilder([
            new TextInputBuilder("title", "Title", TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder("A title for your embed.")
          ]),
          new ActionRowBuilder([
            new TextInputBuilder("description", "Description", TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder(
                "A description for your embed. Tip: You can make clickable text [like this!](https://discord.com)"
              )
          ])
        )
        .setTitle("Create a Webhook"),
      async (ctx: ModalSubmitContext<State>): Promise<void> => {
        const title = ctx.components.get("title"),
          description = ctx.components.get("description");

        const name = ctx.components.get("name");

        if (!name || !title || !description) throw new Error("Missing name or embed data.");

        let webhookData: APIWebhook;

        try {
          webhookData = (await ctx.manager.rest.post(`/channels/${ctx.interaction.channel_id}/webhooks`, {
            body: {
              name: name.value ?? "Easy Roles",
              avatar: AvatarData.data
            }
          })) as APIWebhook;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          switch (err.code as number) {
            case 30007: {
              await ctx.reply(SimpleError(`You've reached the maximum number of webhooks.`).setEphemeral(true));
              break;
            }
            default: {
              console.error(err);
              await ctx.reply(SimpleError("An unknown error occurred.").setEphemeral(true));
              break;
            }
          }

          return;
        }

        const webhookDataIndex =
          ctx.db.webhooks.push({
            channelId: webhookData.channel_id,

            id: webhookData.id,
            token: webhookData.token
          }) - 1;

        await ctx.db.save();

        const webhook = new InteractionWebhook(webhookData.id, webhookData.token as string);

        const message = SimpleEmbed(description.value, title.value);
        const sentMessage = await webhook.send(message);

        ctx.db.webhooks[webhookDataIndex].lastSentId = sentMessage.id;
        ctx.db.webhooks[webhookDataIndex].components = JSON.stringify(message.toJSON().components);

        await ctx.db.save();

        return ctx.reply(SimpleEmbed("Success!").setEphemeral(true));
      }
    ),
    new Modal(
      "createEmbed",
      new ModalBuilder()
        .addComponents(
          new ActionRowBuilder([new TextInputBuilder("title", "Title", TextInputStyle.Short).setRequired(true)]),
          new ActionRowBuilder([
            new TextInputBuilder("description", "Description", TextInputStyle.Paragraph).setRequired(true)
          ])
        )
        .setTitle("Create an Embed"),
      async (ctx: ModalSubmitContext): Promise<void> => {
        const title = ctx.components.get("title"),
          description = ctx.components.get("description");

        const webhookDataIndex = ctx.db.webhooks.findIndex((w) => w.channelId === ctx.interaction.channel_id);
        const webhookData = ctx.db.webhooks[webhookDataIndex];

        if (!title || !description || !webhookData) throw new Error("Missing components.");

        const webhook = new InteractionWebhook(webhookData.id, webhookData.token);

        const message = SimpleEmbed(description.value, title.value);
        const sentMessage = await webhook.send(message);

        console.log(sentMessage.toString());
        console.log(ctx.db.webhooks);

        ctx.db.webhooks[webhookDataIndex].lastSentId = sentMessage.id;
        ctx.db.webhooks[webhookDataIndex].components = JSON.stringify(message.toJSON().components);

        console.log(ctx.db.webhooks);

        await ctx.db.save();

        return ctx.reply(SimpleEmbed("Success!").setEphemeral(true));
      }
    )
  ];
}
