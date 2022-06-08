import {
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIMessageActionRowComponent,
  ComponentType
} from "discord-api-types/v10";
import {
  ActionRowBuilder,
  Button,
  ButtonBuilder,
  ButtonContext,
  ButtonStyle,
  EmbedBuilder,
  InteractionWebhook,
  MessageBuilder,
  SelectMenu,
  SelectMenuBuilder,
  SelectMenuContext,
  SelectMenuOptionBuilder,
  SimpleEmbed,
  SimpleError
} from "interactions.ts";
import { Guild } from "../../models/Guild";
import { stringifyEmoji } from "../../util/stringify-emoji";

type State1 = {
  parentId: string;
};

const StartDeleteRoleButton = new Button(
  "removeRoleButton",
  new ButtonBuilder(ButtonStyle.Primary, "Remove Role Button").setEmoji({ name: "🗑" }),
  async (ctx: ButtonContext<State1>) => {
    if (!ctx.state) return;
    await ctx.defer();

    if (!ctx.webhook) {
      await ctx.send(SimpleError("Webhook not found.").setEphemeral(true));
      return;
    }

    const message = ctx.webhook.messages.get(ctx.state.parentId);

    if (!message) {
      await ctx.send(new MessageBuilder().setEphemeral(true).setContent("Message not found."));

      return;
    }

    const components: APIActionRowComponent<APIMessageActionRowComponent>[] = message.components
      ? JSON.parse(message.components)
      : [];

    if (components.length === 0) {
      await ctx.send(SimpleError("No buttons found.").setEphemeral(true));
      return;
    }

    const buttonMenu = await ctx.createComponent<SelectMenuBuilder>("selectDeletedButton", {
      parentId: ctx.state.parentId
    });

    let id = 0;
    for (const actionRow of components) {
      for (const component of actionRow.components) {
        id += 1;

        if (component.type === ComponentType.Button) {
          const emoji = `${component.emoji ? stringifyEmoji(component.emoji) : ""}`;

          buttonMenu.addOptions(
            new SelectMenuOptionBuilder()
              .setLabel(`${component.label ? `${component.label}${emoji}` : `${emoji}`}`)
              .setValue(id.toString())
          );
        }
      }
    }

    await ctx.send(
      new MessageBuilder(new EmbedBuilder("Please Select a Button to Remove"))
        .addComponents(new ActionRowBuilder([buttonMenu]))
        .setEphemeral(true)
    );
  }
);

const SelectDeletedButton = new SelectMenu(
  "selectDeletedButton",
  new SelectMenuBuilder().setMaxValues(1),
  async (ctx: SelectMenuContext<State1>) => {
    if (!ctx.state) return;

    if (!ctx.webhook) {
      return ctx.reply(SimpleError("Webhook not found.").setEphemeral(true));
    }

    const message = ctx.webhook.messages.get(ctx.state.parentId);

    if (!message) {
      return ctx.reply(new MessageBuilder().setEphemeral(true).setContent("Message not found."));
    }

    const components: APIActionRowComponent<APIMessageActionRowComponent>[] = message.components
      ? JSON.parse(message.components)
      : [];

    const targetId = parseInt(ctx.values[0]) - 1;

    components[Math.floor(targetId / 5)].components.splice(targetId % 5, 1);

    if (components[Math.floor(targetId / 5)].components.length === 0) {
      components.splice(Math.floor(targetId / 5), 1);
    }

    let id = 0;
    for (const actionRow of components) {
      for (const component of actionRow.components) {
        id += 1;
        if (id > targetId) {
          const state = JSON.parse((component as APIButtonComponentWithCustomId).custom_id.split("|")[1]);
          state.id -= 1;

          (component as APIButtonComponentWithCustomId).custom_id = `${
            (component as APIButtonComponentWithCustomId).custom_id.split("|")[0]
          }|${JSON.stringify(state)}`;
        }
      }
    }

    const messageDoc = ctx.db.webhooks.get(ctx.webhook.channelId)?.messages.get(message.id);
    if (messageDoc) messageDoc.components = JSON.stringify(components);

    ctx.db.markModified("webhooks");
    await ctx.db.save();

    const webhook = new InteractionWebhook(ctx.webhook.id, ctx.webhook.token);

    try {
      await webhook.edit(new MessageBuilder({ components }), message.id);
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

          const update: {
            $unset: {
              [key: string]: string;
            };
          } = {
            $unset: {}
          };

          update["$unset"][`webhooks.${ctx.webhook.id}`] = "";

          await Guild.updateOne({ id: ctx.db.id }, update);
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

    return ctx.reply(SimpleEmbed("Role Button Removed").setComponents([]).setEphemeral(true));
  }
);

export const DeleteRoleButtonButtons = [StartDeleteRoleButton, SelectDeletedButton];
