import { APIActionRowComponent, APIMessageActionRowComponent } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionWebhook,
  ISlashCommand,
  MessageBuilder,
  PermissionBits,
  SimpleEmbed,
  SimpleError,
  SlashCommandBuilder,
  SlashCommandContext,
  SlashCommandIntegerOption,
  SlashCommandRoleOption,
  SlashCommandStringOption
} from "interactions.ts";

export class CreateRoleButton implements ISlashCommand {
  public builder = new SlashCommandBuilder("create-role-button", "Create a Self-Role button on your most recent menu.")
    .addRoleOption(new SlashCommandRoleOption("role", "The role to assign to the button.").setRequired(true))
    .addIntegerOption(
      new SlashCommandIntegerOption("colour", "A background colour for your button.").setRequired(true).addChoices(
        {
          name: "Blue",
          value: ButtonStyle.Primary
        },
        {
          name: "Grey",
          value: ButtonStyle.Secondary
        },
        {
          name: "Green",
          value: ButtonStyle.Success
        },
        {
          name: "Red",
          value: ButtonStyle.Danger
        }
      )
    )
    .addStringOption(new SlashCommandStringOption("label", "A label for your button."))
    .addStringOption(new SlashCommandStringOption("emoji", "An emoji for your button."))
    .addStringOption(
      new SlashCommandStringOption("secret", "A secret key users will need to enter to use this button.")
    )
    .setDMEnabled(false)
    .addRequiredPermissions(PermissionBits.ADMINISTRATOR);

  public handler = async (ctx: SlashCommandContext): Promise<void> => {
    if (ctx.webhook === undefined || Object.keys(ctx.webhook.messages).length === 0) {
      return ctx.reply(SimpleError("You need to use ``/create-menu`` first.").setEphemeral(true));
    }

    if (!ctx.hasOption("label") && !ctx.hasOption("emoji")) {
      return ctx.reply(SimpleError("You must provide either a label or an emoji.").setEphemeral(true));
    }

    if (!ctx.hasOption("colour")) {
      return ctx.reply(SimpleError("You must provide a colour.").setEphemeral(true));
    }

    const webhook = new InteractionWebhook(ctx.webhook.id, ctx.webhook.token);
    const message = ctx.webhook.messages.get(ctx.webhook.latestMessage);

    if (!message) {
      return ctx.reply(new MessageBuilder().setEphemeral(true).setContent("Message not found."));
    }

    const components: APIActionRowComponent<APIMessageActionRowComponent>[] = message.components
      ? JSON.parse(message.components)
      : [];

    async function getButton(id: number): Promise<ButtonBuilder> {
      const button = await ctx.createGlobalComponent<ButtonBuilder>("addRole", {
        roleId: ctx.getRoleOption("role").value,
        id
      });

      button.setStyle(ctx.getIntegerOption("colour").value);

      if (ctx.hasOption("label")) button.setLabel(ctx.getStringOption("label").value);
      if (ctx.hasOption("emoji")) button.setEmoji({ name: ctx.getStringOption("emoji").value });

      return button;
    }

    let pushed = false;
    let componentCount = 0;

    let button: ButtonBuilder;

    for (const actionRow of components) {
      componentCount += actionRow.components.length;

      if (actionRow.components.length < 5) {
        button = await getButton(componentCount);
        actionRow.components.push(button.toJSON());

        pushed = true;
      }
    }

    if (!pushed) {
      button = await getButton(componentCount);
      components.push(new ActionRowBuilder([button]).toJSON());
    }

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

    const messageDoc = ctx.db.webhooks.get(ctx.webhook.channelId)?.messages.get(message.id);
    if (messageDoc) messageDoc.components = JSON.stringify(components);

    ctx.db.markModified("webhooks");
    await ctx.db.save();

    return ctx.reply(SimpleEmbed("Button created!").setEphemeral(true));
  };
}
