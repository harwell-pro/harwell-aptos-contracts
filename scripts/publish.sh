base=$(
    cd "$(dirname "$0")" || exit
    pwd
)
cd "$base" || exit
cd ..

network=$1
package=$2
profile=$3

echo publish $1 to $2

aptos move publish --profile $profile --assume-yes --package-dir ./contracts/$package --url "https://fullnode.$network.aptoslabs.com"
