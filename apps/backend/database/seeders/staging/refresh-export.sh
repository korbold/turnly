#!/usr/bin/env bash
# Dumps production's CONFIG tables as JSON, one block per table. Read-only:
# every statement is a SELECT. Run it on the prod box and keep the output.
#
#   ssh root@<prod> 'bash -s' < refresh-export.sh > /tmp/prodcfg.txt
#
# Feed the result to refresh-fixture.py, which is what strips the people out.
set -euo pipefail

cd /var/www/turnly/apps/backend
DB=$(grep -m1 '^DB_DATABASE=' .env | cut -d= -f2)
U=$(grep -m1 '^DB_USERNAME=' .env | cut -d= -f2)
P=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2-)
M=(mysql -u"$U" -p"$P" -N -B "$DB")

TABLES="'plans','business_categories','tenants','services','service_variants','products','service_variant_consumption','business_resources','service_staff'"

# Build one "select json_arrayagg(json_object('col', `col`, ...)) from `t`;"
# per table, so the column list never has to be maintained by hand here.
"${M[@]}" -e "
set session group_concat_max_len = 1000000;
select concat('select json_arrayagg(json_object(',
              group_concat(concat(char(39), column_name, char(39), ',\`', column_name, '\`') order by ordinal_position),
              ')) from \`', table_name, '\`;')
from information_schema.columns
where table_schema = '$DB' and table_name in ($TABLES)
group by table_name;" > /tmp/staging-export.sql

while read -r query; do
  table=$(printf '%s' "$query" | sed 's/.*from `\(.*\)`;/\1/')
  printf '=====TABLE:%s\n' "$table"
  "${M[@]}" --raw -e "$query"
done < /tmp/staging-export.sql

rm -f /tmp/staging-export.sql
