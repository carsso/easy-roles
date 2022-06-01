import {
  ActionRowBuilder,
  Button,
  ButtonBuilder,
  ButtonContext,
  CommandGroupBuilder,
  ICommandGroup,
  MessageBuilder,
  PermissionBits,
  SimpleEmbed,
  SlashCommandContext,
  SlashCommandRoleOption,
  SubcommandOption
} from "interactions.ts";

export class Autorole implements ICommandGroup {
  public builder = new CommandGroupBuilder("autorole", "Manage your autoroles.")
    .addSubcommands(
      new SubcommandOption("view", "View a list of your autoroles."),
      new SubcommandOption("add", "Add an autorole to your server.").addRoleOption(
        new SlashCommandRoleOption("role", "The role to add.").setRequired(true)
      ),
      new SubcommandOption("remove", "Remove an autorole from your server.").addRoleOption(
        new SlashCommandRoleOption("role", "The role to remove.").setRequired(true)
      )
    )
    .addRequiredPermissions(PermissionBits.ADMINISTRATOR);

  public handlers = {
    view: {
      handler: async (ctx: SlashCommandContext) => {
        return ctx.reply(await buildAutoroleMenu(ctx));
      }
    },
    add: {
      handler: async (ctx: SlashCommandContext) => {
        if (ctx.db.autoroles.length === 1)
          return ctx.reply(SimpleEmbed("You already have an autorole.").setEphemeral(true));

        ctx.db.autoroles.push(ctx.getRoleOption("role").value);
        await ctx.db.save();

        return ctx.reply(SimpleEmbed("Autorole added!").setEphemeral(true));
      }
    },
    remove: {
      handler: async (ctx: SlashCommandContext) => {
        const roleId = ctx.getRoleOption("role").value;
        const autorole = ctx.db.autoroles.findIndex((role) => role === roleId);

        if (autorole === -1) {
          return ctx.reply(SimpleEmbed("That role is not an autorole.").setEphemeral(true));
        }

        ctx.db.autoroles.splice(autorole, 1);
        await ctx.db.save();

        return ctx.reply(SimpleEmbed("Autorole removed!").setEphemeral(true));
      }
    }
  };

  public components = [
    new Button(
      "refresh",
      new ButtonBuilder().setEmoji({ name: "🔄" }).setStyle(2),
      async (ctx: ButtonContext): Promise<void> => {
        return ctx.reply(await buildAutoroleMenu(ctx));
      }
    )
  ];
}

async function buildAutoroleMenu(ctx: SlashCommandContext | ButtonContext): Promise<MessageBuilder> {
  const component = await ctx.createComponent("refresh");

  return SimpleEmbed(
    ctx.db.autoroles.map((role) => `<@&${role}>`).join(", ") || "No autoroles configured.",
    "Autoroles"
  )
    .addComponents(new ActionRowBuilder([component]))
    .setEphemeral(true);
}
