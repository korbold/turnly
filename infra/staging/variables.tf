# Credentials come from the environment, never from a .tfvars file and never
# with a default. Terraform writes every variable it reads into the state in
# plain text, so the two API keys stay as TF_VAR_* env vars:
#
#   export TF_VAR_vultr_api_key=...        # Vultr → Account → API
#   export TF_VAR_cloudflare_api_token=... # already present as CF_API_TOKEN
#
# The Vultr key is account-wide — Vultr cannot scope a key to one instance or
# tag. It can destroy turnly-prod. Read every `plan` before applying.

variable "vultr_api_key" {
  description = "Vultr API key. Account-wide; the ACL in the Vultr panel must allow the IP running terraform."
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare token with DNS:Edit on the goturnly.com zone."
  type        = string
  sensitive   = true
}

variable "zone_name" {
  description = "Cloudflare zone. Shared with production — see the guard in main.tf."
  type        = string
  default     = "goturnly.com"
}

variable "api_hostname" {
  description = "FQDN for the staging API. Follows the existing api.dev.goturnly.com convention."
  type        = string
  default     = "api.staging.goturnly.com"
}

variable "region" {
  description = "Vultr region code. Matches prod (Miami)."
  type        = string
  default     = "mia"
}

variable "plan" {
  description = <<-EOT
    Vultr plan. Prod runs vc2-2c-4gb but uses 1084 MB of 3910 (28%) at load
    average 0.02, so staging runs vc2-1c-2gb ($10/mo) — still ~2x prod's real
    consumption. RAM is the only dimension where staging differs from prod.
  EOT
  type        = string
  default     = "vc2-1c-2gb"
}

variable "ssh_public_key_path" {
  description = "Public key installed for root and for the deploy user."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "deploy_public_key" {
  description = <<-EOT
    Public half of the keypair GitHub Actions uses to deploy. The PRIVATE half
    lives only in the STAGING_DEPLOY_SSH_KEY repo secret and nowhere on disk —
    GitHub cannot read a secret back, so losing it means generating a new pair
    and re-setting the secret. Committing the public half is what lets a
    destroy/rebuild come back deployable without manual steps.
  EOT
  type        = string
  default     = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGOMFfgNWAWbcTxIww1y1Va1NfN3NgPHPdsJ/4/yToQ4 gha-staging-deploy@turnly"
}
