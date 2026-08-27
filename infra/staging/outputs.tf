output "instance_ip" {
  description = "Public IPv4 of the staging box. Goes into the STAGING_DEPLOY_HOST secret."
  value       = vultr_instance.staging.main_ip
}

output "api_url" {
  description = "Where the staging API answers once the deploy workflow has issued the certificate."
  value       = "https://${var.api_hostname}"
}

output "ssh_command" {
  description = "First thing to run after apply."
  value       = "ssh deploy@${vultr_instance.staging.main_ip}"
}

output "next_steps" {
  value = <<-EOT
    1. Wait ~3 min for cloud-init: ssh root@${vultr_instance.staging.main_ip} 'cloud-init status --wait'
    2. Check the SRI extension landed:  php -m | grep -x soap
    3. Set the repo secrets: STAGING_DEPLOY_HOST=${vultr_instance.staging.main_ip},
       STAGING_DEPLOY_USER=deploy, STAGING_DEPLOY_PATH=/var/www/turnly,
       STAGING_DEPLOY_SSH_KEY=<private half of deploy_public_key>
    4. Phase 2: deploy-staging.yml. Units are enabled but stopped until then.
  EOT
}
