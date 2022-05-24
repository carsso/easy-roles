import { APIActionRowComponent, APIMessageActionRowComponent, Routes } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  Button,
  ButtonBuilder,
  ButtonContext,
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

type State = {
  roleId: string;
};

export class CreateRoleButton implements ISlashCommand {
  public builder = new SlashCommandBuilder("create-role-button", "Create an embed for the bot to post.")
    .addRoleOption(new SlashCommandRoleOption("role", "The role to assign to the button.").setRequired(true))
    .addIntegerOption(
      new SlashCommandIntegerOption("style", "A label for your button.").setRequired(true).addChoices(
        {
          name: "Primary",
          value: ButtonStyle.Primary
        },
        {
          name: "Secondary",
          value: ButtonStyle.Secondary
        },
        {
          name: "Success",
          value: ButtonStyle.Success
        },
        {
          name: "Danger",
          value: ButtonStyle.Danger
        }
      )
    )
    .addStringOption(new SlashCommandStringOption("label", "A label for your button.").setRequired(true))
    .addStringOption(new SlashCommandStringOption("emoji", "An emoji for your button."))
    .setDMEnabled(false)
    .addRequiredPermissions(PermissionBits.ADMINISTRATOR);

  public handler = async (ctx: SlashCommandContext): Promise<void> => {
    const webhookDataIndex = ctx.db.webhooks.findIndex((w) => w.channelId === ctx.interaction.channel_id);
    const webhookData = ctx.db.webhooks[webhookDataIndex];

    if (!webhookData) {
      return ctx.reply(
        SimpleError("You can only use this command on messages sent by one of your webhooks.").setEphemeral(true)
      );
    }

    if (!webhookData.lastSentId) {
      return ctx.reply(
        SimpleError("You can only use this command in a channel with a role menu ready.").setEphemeral(true)
      );
    }

    const button = await ctx.createComponent<ButtonBuilder>("addRole", {
      roleId: ctx.getRoleOption("role").value
    });

    button.setStyle(ctx.getIntegerOption("style").value);

    if (ctx.hasOption("label")) button.setLabel(ctx.getStringOption("label").value);
    if (ctx.hasOption("emoji")) button.setEmoji({ name: ctx.getStringOption("label").value });

    const webhook = new InteractionWebhook(webhookData.id, webhookData.token);

    const components: APIActionRowComponent<APIMessageActionRowComponent>[] = webhookData.components
      ? JSON.parse(webhookData.components)
      : [];

    let pushed = false;

    for (const actionRow of components) {
      if (actionRow.components.length < 5) {
        actionRow.components.push(button.toJSON());

        pushed = true;
      }
    }

    if (!pushed) components.push(new ActionRowBuilder([button]).toJSON());

    ctx.db.webhooks[webhookDataIndex].components = JSON.stringify(components);

    await ctx.db.save();

    await webhook.edit(new MessageBuilder({ components }), webhookData.lastSentId);

    return ctx.reply(SimpleEmbed("Button created!").setEphemeral(true));
  };

  public components = [
    new Button("addRole", new ButtonBuilder(), async (ctx: ButtonContext<State>) => {
      if (!ctx.state || !ctx.interaction.guild_id)
        return ctx.reply(SimpleError("Role ID not found.").setEphemeral(true));

      if (!ctx.interaction.member) return ctx.reply(SimpleError("Member not found.").setEphemeral(true));

      await ctx.defer();

      let method: "delete" | "put" = "put";

      if (ctx.interaction.member.roles.find((id) => id === ctx.state?.roleId)) {
        method = "delete";
      }

      try {
        await ctx.manager.rest[method](
          Routes.guildMemberRole(ctx.interaction.guild_id, ctx.interaction.member.user.id, ctx.state.roleId)
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        switch (err.code as number) {
          case 30007: {
            await ctx.send(SimpleError(`You've reached the maximum number of webhooks.`).setEphemeral(true));
            break;
          }
          default: {
            console.error(err);
            await ctx.send(SimpleError("An unknown error occurred.").setEphemeral(true));
            break;
          }
        }

        return;
      }
    })
  ];
}
