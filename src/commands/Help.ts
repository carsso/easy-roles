import { EmbedBuilder, ISlashCommand, MessageBuilder, SlashCommandBuilder, SlashCommandContext } from "interactions.ts";

export class Help implements ISlashCommand {
  public builder = new SlashCommandBuilder("help", "Get support with using the bot.");

  public handler = async (ctx: SlashCommandContext): Promise<void> => {
    return ctx.reply(
      new MessageBuilder(
        new EmbedBuilder(
          "Help",
          `
          If you're just curious about how to use the bot, check the \`\`/about\`\` command for a basic explanation. 
          
          If that's not enough, [click here](https://discord.gg/JVJjP5DM8U) to visit our Discord server where we can help you.`
        )
      )
    );
  };
}
