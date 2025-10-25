# Easy Roles

A Discord bot for creating password-protected private channels. Users can access private channels by clicking buttons and entering the correct secret key to get the required role.

## How it works

1. Use `/create-menu` to start creating a role menu
2. Add role buttons using `/create-role-button` or through the interactive menu by holding/right clicking on a message and selecting Apps → Manage Role Buttons
3. Users click buttons and enter the secret key to get the role
4. The role gives access to password-protected private channels

> Original project by [@ssMMiles/easy-roles](https://github.com/ssMMiles/easy-roles)

## Production

### Prerequisites
- Docker & Docker Compose (https://docs.docker.com/get-docker/)
- Git
- Systemd
- Reverse proxy (Apache, Nginx, Traefik, etc.)
- Domain with SSL certificate (for Discord interactions endpoint)

### Clone the repository
```bash
git clone https://github.com/carsso/easy-roles.git /opt/easy-roles
cd /opt/easy-roles
```

**Note**: The bot will listen on port 8082. Make sure to configure your reverse proxy (nginx, traefik, etc.) to forward HTTPS traffic to `localhost:8082`.

### Environment Setup

Copy environment file:
```bash
cp .env-example .env
```

### Create Discord application and invite the bot to your server

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "General Information"
4. Copy the "Application ID" and "Public Key" to your `.env` file
5. Set the **Interactions Endpoint URL**:
   - Use your domain with SSL certificate (see Prerequisites above)
   - Configure your reverse proxy to forward HTTPS traffic to port 8082
   - Example: `https://bot.yourdomain.com/`
6. Go to "Installation" section
7. Configure installation contexts:
   - ✅ Check "Guild Install" (for server installation)
   - ❌ Leave "User Install" unchecked
8. Set default install settings:
   - **Scopes**: `applications.commands` and `bot`
   - **Permissions**: `Manage Channels`, `Manage Roles`, `Manage Webhooks`, and `View Channels`
9. Copy the install link provided by Discord
10. Use the link to invite the bot to your server
11. Go to "Bot" section and copy the token to your `.env` file

### Install the systemd service

```bash
sudo cp easy-roles.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable easy-roles
sudo systemctl start easy-roles
```

## Development

### Prerequisites
- Docker & Docker Compose
- Node.js & Yarn (for local development outside of Docker)
- Reverse proxy (Apache, Nginx, Traefik, etc.)
- Domain with SSL certificate (for Discord interactions endpoint)

### Clone the repository
```bash
git clone https://github.com/carsso/easy-roles.git easy-roles
cd easy-roles
```

**Note**: The bot will listen on port 8082. Make sure to configure your reverse proxy (nginx, traefik, etc.) to forward HTTPS traffic to `localhost:8082`.

### Environment Setup

Copy environment file:
```bash
cp .env-example .env
```

### Create Discord application and invite the bot to your server

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "General Information"
4. Copy the "Application ID" and "Public Key" to your `.env` file
5. Set the **Interactions Endpoint URL**:
   - Use your domain with SSL certificate (see Prerequisites above)
   - Configure your reverse proxy to forward HTTPS traffic to port 8082
   - Example: `https://bot.yourdomain.com/`
6. Go to "Installation" section
7. Configure installation contexts:
   - ✅ Check "Guild Install" (for server installation)
   - ❌ Leave "User Install" unchecked
8. Set default install settings:
   - **Scopes**: `applications.commands` and `bot`
   - **Permissions**: `Manage Channels`, `Manage Roles`, `Manage Webhooks`, and `View Channels`
9. Copy the install link provided by Discord
10. Use the link to invite the bot to your server
11. Go to "Bot" section and copy the token to your `.env` file

### Quick Start
```bash
# Start development environment with hot reload
make dev

# View development logs
make dev-logs
```

### Available Commands
- `make dev` - Start development environment with hot reload
- `make dev-build` - Build and start development environment  
- `make dev-logs` - Show development logs
- `make prod` - Start production environment
- `make stop` - Stop all containers
- `make restart` - Restart all containers
- `make status` - Show container status
- `make clean` - Remove containers, networks, and volumes
- `make build` - Build Docker image
- `make logs` - Show logs for all services
- `make install` - Install dependencies locally
- `make help` - Show all available commands