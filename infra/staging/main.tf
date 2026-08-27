# Staging environment for Turnly. Phase 1 of
# docs/superpowers/specs/2026-08-26-staging-e2e-design.md — provisioning only.
#
# What this file may touch:  the staging instance, its firewall, its ssh key,
#                            and ONE dns record.
# What it must never touch:  anything belonging to production. turnly-prod is
#                            deliberately absent from this state. Do not
#                            `terraform import` it — see guard 1 in the spec.
#
# The Cloudflare zone is SHARED with production. This config declares a single
# `cloudflare_dns_record` and never a zone resource, because Cloudflare cannot
# scope a token down to one record: a zone-level resource here could take
# api.goturnly.com off the internet and every tenant with it.

data "cloudflare_zone" "main" {
  filter = {
    name = var.zone_name
  }
}

data "vultr_os" "ubuntu" {
  filter {
    name   = "name"
    values = ["Ubuntu 24.04 LTS x64"]
  }
}

resource "vultr_ssh_key" "operator" {
  name    = "turnly-staging-operator"
  ssh_key = trimspace(file(pathexpand(var.ssh_public_key_path)))
}

resource "vultr_firewall_group" "staging" {
  description = "turnly-staging"
}

# Port 22 stays open to the world on purpose: GitHub Actions deploys over SSH
# and its runners have rotating IPs, so an allowlist would break every deploy.
# The box is key-only (cloud-init disables password auth).
resource "vultr_firewall_rule" "ssh_v4" {
  firewall_group_id = vultr_firewall_group.staging.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "22"
  notes             = "ssh - github actions deploy"
}

resource "vultr_firewall_rule" "http_v4" {
  firewall_group_id = vultr_firewall_group.staging.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "80"
  notes             = "http - certbot challenge + redirect"
}

resource "vultr_firewall_rule" "https_v4" {
  firewall_group_id = vultr_firewall_group.staging.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "443"
  notes             = "https"
}

# Reverb listens on 8080 but is NOT exposed: nginx proxies /app and /apps to
# 127.0.0.1:8080, same as prod. Billing on 8100 is likewise loopback-only.

resource "vultr_instance" "staging" {
  region            = var.region
  plan              = var.plan
  os_id             = data.vultr_os.ubuntu.id
  label             = "turnly-staging"
  hostname          = "turnly-staging"
  tags              = ["staging", "turnly"]
  enable_ipv6       = false
  activation_email  = false
  backups           = "disabled"
  firewall_group_id = vultr_firewall_group.staging.id
  ssh_key_ids       = [vultr_ssh_key.operator.id]

  # Plain text on purpose. The provider base64-encodes user_data itself
  # (resource_vultr_instance.go: base64.StdEncoding.EncodeToString), so wrapping
  # this in base64encode() double-encodes it and cloud-init silently no-ops.
  user_data = templatefile("${path.module}/cloud-init.yaml", {
    api_hostname      = var.api_hostname
    deploy_public_key = var.deploy_public_key
    operator_key      = trimspace(file(pathexpand(var.ssh_public_key_path)))
  })

  lifecycle {
    # Changing hostname triggers an OS REINSTALL on Vultr, not an update.
    # Fail the plan instead of quietly wiping the box.
    ignore_changes = [hostname]
  }
}

resource "cloudflare_dns_record" "api_staging" {
  zone_id = data.cloudflare_zone.main.zone_id
  name    = var.api_hostname
  type    = "A"
  content = vultr_instance.staging.main_ip
  ttl     = 300
  proxied = false # the whole zone is DNS-only today; certbot needs it too
  comment = "turnly staging api - managed by terraform"
}
