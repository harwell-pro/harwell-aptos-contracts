import Decimal from "decimal.js";

const MINIMUM_LIQUIDITY = new Decimal(1000);

export function getFee(
    coinX: string,
    coinY: string,
    reserveX: number,
    reserveY: number,
    kLast: number,
    totalLpSupply: number
): number {
    if (coinX < coinY) {
        return _getFee(reserveX, reserveY, kLast, totalLpSupply);
    } else {
        return _getFee(reserveY, reserveX, kLast, totalLpSupply);
    }
}

function _getFee(reserveX: number, reserveY: number, kLast: number, totalLpSupply: number): number {
    if (kLast != 0) {
        let [rX, rY, kl, ls] = [
            new Decimal(reserveX),
            new Decimal(reserveY),
            new Decimal(kLast),
            new Decimal(totalLpSupply),
        ];
        let root_k = rX.mul(rY).sqrt();
        let root_k_last = kl.sqrt();
        if (root_k > root_k_last) {
            // let numerator = lp_supply * (root_k - root_k_last) * 8number;
            let numerator = ls.mul(root_k.sub(root_k_last)).mul(new Decimal(8));
            // let denominator = root_k_last * 17number + (root_k * 8number);
            let denominator = root_k_last.mul(new Decimal(17)).add(root_k.mul(new Decimal(8)));
            let liquidity = numerator.div(denominator);
            return Math.trunc(liquidity.toNumber());
        }
    }
    return 0;
}
export function getBurnXY(
    coinX: string,
    coinY: string,
    balanceX: number,
    balanceY: number,
    totalLpSupply: number,
    liquidity: number
): [number, number] {
    if (coinX < coinY) {
        return _getBurnXY(balanceX, balanceY, totalLpSupply, liquidity);
    } else {
        return _getBurnXY(balanceY, balanceX, totalLpSupply, liquidity);
    }
}

function _getBurnXY(balanceX: number, balanceY: number, totalLpSupply: number, liquidity: number): [number, number] {
    let [bX, bY, ls, lq] = [
        new Decimal(balanceX),
        new Decimal(balanceY),
        new Decimal(totalLpSupply),
        new Decimal(liquidity),
    ];
    // let amount_x = ((balance_x  ) * (liquidity  ) / total_lp_supply  );
    let amount_x = bX.mul(lq).div(ls);
    let amount_y = bY.mul(lq).div(ls);
    return [Math.trunc(amount_x.toNumber()), Math.trunc(amount_y.toNumber())];
}

export function getLiquidity(
    coinX: string,
    coinY: string,
    reserveX: number,
    reserveY: number,
    amountX: number,
    amountY: number,
    totalLpSupply: number
): number {
    if (coinX < coinY) {
        return _getLiquidity(reserveX, reserveY, amountX, amountY, totalLpSupply);
    } else {
        return _getLiquidity(reserveY, reserveX, amountY, amountX, totalLpSupply);
    }
}
//TODO,convert to typescript
function _getLiquidity(
    reserveX: number,
    reserveY: number,
    amountX: number,
    amountY: number,
    totalLpSupply: number
): number {
    let rX = new Decimal(reserveX);
    let rY = new Decimal(reserveY);
    let aX = new Decimal(amountX);
    let aY = new Decimal(amountY);
    let ts = new Decimal(totalLpSupply);
    if (totalLpSupply == 0) {
        // let sqrt = math::sqrt(amount_x * amount_y);
        let sqrt = aX.mul(aY).sqrt();
        //assert!(sqrt > MINIMUM_LIQUIDITY, ERROR_INSUFFICIENT_LIQUIDITY_MINTED);
        if (sqrt < MINIMUM_LIQUIDITY) {
            throw new Error("ERROR_INSUFFICIENT_LIQUIDITY_MINTED");
        }
        return Math.trunc(sqrt.sub(MINIMUM_LIQUIDITY).toNumber());
    } else {
        // let liquidity = math::min(amount_x * total_supply / reserve_x , amount_y * total_supply / reserve_y);a
        let liquidity = Math.min(aX.mul(ts).div(rX).toNumber(), aY.mul(ts).div(rY).toNumber());
        if (liquidity <= 0) {
            // assert!(liquidity > 0number, ERROR_INSUFFICIENT_LIQUIDITY_MINTED);
            throw new Error("ERROR_INSUFFICIENT_LIQUIDITY_MINTED");
        }
        return Math.trunc(liquidity);
    }
}

export function getMintXY(
    coinX: string,
    coinY: string,
    reserveX: number,
    reserveY: number,
    amountX: number,
    amountY: number
): [number, number] {
    if (coinX < coinY) {
        return _getMintXY(reserveX, reserveY, amountX, amountY);
    } else {
        return _getMintXY(reserveY, reserveX, amountY, amountX);
    }
}
function _getMintXY(reserveX: number, reserveY: number, amountX: number, amountY: number): [number, number] {
    if (reserveX == 0 && reserveY == 0) {
        return [amountX, amountY];
    } else {
        let amount_y_optimal = quote(amountX, reserveX, reserveY);
        if (amount_y_optimal <= amountY) {
            return [amountX, amount_y_optimal];
        } else {
            let amount_x_optimal = quote(amountY, reserveY, reserveX);
            // assert!(amount_x_optimal <= amount_x, ERROR_INVALID_AMOUNT);
            if (amount_x_optimal > amountX) {
                throw new Error("ERROR_INVALID_AMOUNT");
            }
            return [amount_x_optimal, amountY];
        }
    }
}

export function getAmountOut(amountIn: number, reserveIn: number, reserveOut: number): number {
    let [aIn, rIn, rOut] = [new Decimal(amountIn), new Decimal(reserveIn), new Decimal(reserveOut)];
    let amount_in_with_fee = aIn.mul(new Decimal(9975));
    let numerator = amount_in_with_fee.mul(rOut);
    let denominator = rIn.mul(new Decimal(10000)).add(amount_in_with_fee);
    return Math.trunc(numerator.div(denominator).toNumber());
}

export function getAmountIn(amountOut: number, reserveIn: number, reserveOut: number): number {
    let [aOut, rIn, rOut] = [new Decimal(amountOut), new Decimal(reserveIn), new Decimal(reserveOut)];

    let numerator = rIn.mul(aOut).mul(new Decimal(10000));
    let denominator = rOut.sub(aOut).mul(new Decimal(9975));
    return Math.trunc(numerator.div(denominator).add(new Decimal(1)).toNumber());
}

export function quote(amountX: number, reserveX: number, reserveY: number): number {
    let [aX, rX, rY] = [new Decimal(amountX), new Decimal(reserveX), new Decimal(reserveY)];
    // assert!(amount_x > 0, ERROR_INSUFFICIENT_AMOUNT);
    if (amountX <= 0) {
        throw new Error("ERROR_INSUFFICIENT_AMOUNT");
    }
    // assert!(reserve_x > 0 && reserve_y > 0, ERROR_INSUFFICIENT_LIQUIDITY);
    if (reserveX <= 0 || reserveY <= 0) {
        throw new Error("ERROR_INSUFFICIENT_LIQUIDITY");
    }
    // (((amount_x  ) * (reserve_y  ) / (reserve_x  )) as Decimal)
    return Math.trunc(aX.mul(rY).div(rX).toNumber());
}

export function sortCoin(coinX: string, coinY: string): [string, string] {
    return coinX < coinY ? [coinX, coinY] : [coinY, coinX];
}
