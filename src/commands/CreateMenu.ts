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
import { Message, Webhook } from "../models/Guild";

type State = {
  channelId: string;
};

export class CreateMenu implements ISlashCommand {
  public builder = new SlashCommandBuilder("create-menu", "Create a role menu through the bot.")
    .setDMEnabled(false)
    .addRequiredPermissions(PermissionBits.ADMINISTRATOR);

  public handler = async (ctx: SlashCommandContext): Promise<void> => {
    if (!ctx.webhook) {
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
            new TextInputBuilder("name", "Webhook Username", TextInputStyle.Short)
              .setPlaceholder("Username that will show above your menus.")
              .setMaxLength(32)
              .setRequired(true)
          ]),
          new ActionRowBuilder([
            new TextInputBuilder("title", "Title", TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder("A title for your embed.")
              .setMaxLength(80)
          ]),
          new ActionRowBuilder([
            new TextInputBuilder("description", "Description", TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder(
                "A description for your embed. Tip: You can make clickable text [like this!](https://discord.com)"
              )
              .setMaxLength(4000)
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
              await ctx.reply(
                SimpleError(`You've reached the maximum number of webhooks in this channel.`).setEphemeral(true)
              );
              break;
            }
            case 50001: // Missing Access
            case 50013: {
              await ctx.reply(
                SimpleError(`I need the \`\`Manage Webhooks\`\` permission to send messages for you.`).setEphemeral(
                  true
                )
              );
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

        const webhook = new InteractionWebhook(webhookData.id, webhookData.token as string);

        const message = SimpleEmbed(description.value, title.value);
        let sentMessage;

        try {
          sentMessage = await webhook.send(message);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          switch (err.code as number) {
            case 10015: {
              await ctx.reply(
                SimpleError(
                  `The webhook for this channel seems to have been deleted. This isn't recommended as you'll no longer be able to edit previously created menus, although their buttons will still function.\n\nTo continue, you'll have to create a new menu with \`\`/create-menu\`\`.`
                ).setEphemeral(true)
              );

              break;
            }
            default: {
              console.error(err);
              await ctx.reply(SimpleError("An unknown error occurred while adding your button.").setEphemeral(true));
              break;
            }
          }

          return;
        }

        const messageMap = new Map();

        messageMap.set(
          sentMessage.id,
          new Message({
            id: sentMessage.id,
            components: JSON.stringify(message.toJSON().components)
          })
        );

        ctx.db.webhooks.set(
          webhookData.channel_id,
          new Webhook({
            channelId: webhookData.channel_id,

            id: webhookData.id,
            token: webhookData.token as string,

            latestMessage: sentMessage.id,
            messages: messageMap
          })
        );

        ctx.db.markModified("webhooks");
        await ctx.db.save();

        return ctx.reply(
          SimpleEmbed(
            "Success! Right Click/Hold on the message, go to **Apps** and **Manage Role Buttons** to continue!"
          ).setEphemeral(true)
        );
      }
    ),
    new Modal(
      "createEmbed",
      new ModalBuilder()
        .addComponents(
          new ActionRowBuilder([
            new TextInputBuilder("title", "Title", TextInputStyle.Short).setRequired(true).setMaxLength(80)
          ]),
          new ActionRowBuilder([
            new TextInputBuilder("description", "Description", TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(4000)
          ])
        )
        .setTitle("Create a Menu"),
      async (ctx: ModalSubmitContext): Promise<void> => {
        const title = ctx.components.get("title"),
          description = ctx.components.get("description");

        if (!title || !description || !ctx.webhook) throw new Error("Missing components.");

        if (ctx.webhook.messages.size === 25) {
          return ctx.reply(SimpleError("You can only have 25 menus per channel for now.").setEphemeral(true));
        }

        const webhook = new InteractionWebhook(ctx.webhook.id, ctx.webhook.token);

        const message = SimpleEmbed(description.value, title.value);
        let sentMessage;

        try {
          sentMessage = await webhook.send(message);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          switch (err.code as number) {
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
              await ctx.reply(SimpleError("An unknown error occurred while adding your button.").setEphemeral(true));
              break;
            }
          }

          return;
        }

        ctx.db.webhooks.get(ctx.webhook.channelId)?.messages.set(sentMessage.id, {
          id: sentMessage.id,
          components: JSON.stringify(message.toJSON().components)
        });

        const webhookDoc = ctx.db.webhooks.get(ctx.webhook.channelId);

        if (webhookDoc) {
          webhookDoc.latestMessage = sentMessage.id;
          webhookDoc.messages.set(sentMessage.id, {
            id: sentMessage.id,
            components: JSON.stringify(message.toJSON().components)
          });

          ctx.db.webhooks.set(ctx.webhook.channelId, webhookDoc);
        }

        ctx.db.markModified("webhooks");
        await ctx.db.save();

        return ctx.reply(SimpleEmbed("Success!").setEphemeral(true));
      }
    )
  ];
}
