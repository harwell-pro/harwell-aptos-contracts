network=$1

aptos account list \
    --account 815401357d501dc73b084399f692f942eec25a2fc9f2795cb073a3df6330626f \
    --url "https://fullnode.$network.aptoslabs.com" | jq -M '.. | .account?' | grep -v null | grep -v '"0x1"' | sort

aptos move run \
    --assume-yes \
    --function-id '0x1::resource_account::create_resource_account_and_fund' \
    --args 'string:hwswap-03' 'hex:815401357d501dc73b084399f692f942eec25a2fc9f2795cb073a3df6330626f' 'u64:10000000' \
    --profile default \
    --url "https://fullnode.$network.aptoslabs.com"

aptos account list \
    --account 815401357d501dc73b084399f692f942eec25a2fc9f2795cb073a3df6330626f \
    --url "https://fullnode.$network.aptoslabs.com" | jq -M '.. | .account?' | grep -v null | grep -v '"0x1"' | sort
