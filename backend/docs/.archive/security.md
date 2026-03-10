# Security Guide

This document covers security configurations for ZeroClaw, including firewall setup, monitoring, and best practices.

## Firewall Configuration (UFW)

ZeroClaw includes a UFW (Uncomplicated Firewall) configuration script to secure your installation.

### Automatic Setup

The firewall is configured automatically during bootstrap unless you opt out:

```bash
# Default: firewall is configured automatically
./scripts/bootstrap.sh

# Skip firewall configuration
SKIP_FIREWALL=1 ./scripts/bootstrap.sh
```

### Manual Setup

You can configure the firewall manually at any time:

```bash
# Run the UFW configuration script
sudo ./scripts/configure_ufw.sh

# Skip resetting existing rules (preserves custom rules)
sudo ./scripts/configure_ufw.sh --skip-reset
```

### UFW Rules

The configure_ufw.sh script sets up the following rules:

| Rule | Description |
|------|-------------|
| Default incoming | DENY all incoming connections |
| Default outgoing | ALLOW all outgoing connections |
| SSH (port 22) | ALLOW to prevent lockout |
| ZeroClaw API (port 42617) | LIMIT with rate limiting (prevents brute force) |
| Localhost (127.0.0.1, ::1) | ALLOW for local access |

### Viewing Firewall Status

Check the current UFW status:

```bash
# Show verbose status with numbering
sudo ufw status numbered

# Show verbose status
sudo ufw status verbose

# Show raw rules
sudo ufw show raw
```

### Viewing Firewall Logs

UFW logs are stored in the system logs:

```bash
# View recent UFW logs
sudo tail -f /var/log/ufw.log

# On systems using rsyslog, UFW logs may be in:
sudo tail -f /var/log/syslog | grep -i ufw

# Search for blocked connections
sudo grep -i "UFW BLOCK" /var/log/syslog

# View all UFW-related logs
sudo journalctl -u ufw -f
```

### Firewall Logging Levels

UFW supports different logging levels:

- `off`: disables logging
- `low`: logs all blocked packets not matching the defined policy (with rate limiting)
- `medium`: logs all blocked packets and all allowed packets
- `high`: logs all packets with rate limiting
- `full`: logs all packets without rate limiting

The default configuration uses `medium` logging:

```bash
# Change logging level
sudo ufw logging medium
```

### Modifying Firewall Rules

To add custom rules after the initial setup:

```bash
# Allow a specific port
sudo ufw allow 8080/tcp comment 'Custom service'

# Allow from a specific IP
sudo ufw allow from 192.168.1.100

# Deny a specific port
sudo ufw deny 23/tcp comment 'Block telnet'

# Delete a rule by number
sudo ufw status numbered
sudo ufw delete [number]
```

### Troubleshooting

#### Locked out of SSH

If you're accidentally locked out:

1. Access the server via console
2. Check UFW status: `sudo ufw status numbered`
3. Ensure SSH is allowed: `sudo ufw allow 22/tcp`
4. If needed, disable UFW temporarily: `sudo ufw disable`

#### Resetting Firewall Rules

To reset all rules and start over:

```bash
# Reset to default (WARNING: removes all custom rules)
sudo ufw --force reset

# Re-run the configuration script
sudo ./scripts/configure_ufw.sh
```

#### Testing Firewall Rules

Test firewall rules without modifying them:

```bash
# Dry-run mode (shows what would happen)
sudo ufw --dry-run allow 8080/tcp

# Check if a port is allowed
sudo ufw status | grep 42617
```

## Security Best Practices

1. **Keep ZeroClaw Updated**: Regularly pull the latest changes and rebuild

2. **Use Strong API Keys**: Generate cryptographically strong API keys for provider authentication

3. **Limit Network Exposure**: Only expose necessary ports and use rate limiting

4. **Monitor Logs**: Regularly review UFW logs for suspicious activity

5. **Backup Configuration**: Keep backups of your UFW rules

6. **Test Changes**: Use `--dry-run` to test firewall changes before applying

7. **Document Custom Rules**: Keep records of any custom firewall rules you add

## Additional Resources

- [UFW Community Documentation](https://help.ubuntu.com/community/UFW)
- [ZeroClaw Architecture](./architecture.md)
- [Security Roadmap](./security-roadmap.md)
- [Agnostic Security Model](./agnostic-security.md)
