import path from "path";
import fs from "fs";
import YAML from "yaml";
import { AptosAccount } from "aptos";

export const aptosCoinStore = "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>";

export const projectPath = path.resolve(`${__dirname}/../`);

export function getNodeUrl(network: string): string {
    return `https://fullnode.${network}.aptoslabs.com`;
}
export function readConfig(): any {
    let configPath = path.join(projectPath, ".aptos", "config.yaml");
    const file = fs.readFileSync(configPath, "utf8");
    return YAML.parse(file);
}

export function parseAccount(config: any, accountName: string): AptosAccount {
    let privateKey: string = config.profiles[accountName].private_key.substring(2);
    let account: string = config.profiles[accountName].account;
    return new AptosAccount(Uint8Array.from(Buffer.from(privateKey, "hex")), account);
}

export function toHexString(s: string): string {
    return Buffer.from(s, "utf-8").toString("hex");
}

export function unitToOctas(n: number): number {
    return Math.floor(n * 1e8);
}

export function octasToUnit(n: number): number {
    return (n * 1.0) / 1e8;
}
