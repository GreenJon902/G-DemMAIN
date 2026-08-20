import discord

async def get_or_create_webhook(channel, webhook_name):
    """
    Gets g_discord's webhook for channel, creating it if it doesn't already exist.
    This ensures that the webhook is usable by the current bot, if it was created by another bot then it a new one is also created.
    """
    for webhook in await channel.webhooks():
        if webhook.name == webhook_name:
            if webhook.token is None:  # If webhook created by another bot then this is true, we cannot use a webhook from another bot
                print(f"Webhook \"{webhook_name}\" exists but created by another bot...")
                continue
            print(f"Found existing webhook \"{webhook_name}\"")
            return webhook
    print(f"Creating new webhook \"{webhook_name}\"")
    return await channel.create_webhook(name=webhook_name)

async def get_or_create_role(guild, role_name):
    """
    Gets guild's role_name role, creating it if it doesn't already exist.
    """
    role = discord.utils.get(guild.roles, name=role_name)
    if role is not None:
        return role
    print(f"Creating new role \"{role_name}\"")
    return await guild.create_role(name=role_name)

