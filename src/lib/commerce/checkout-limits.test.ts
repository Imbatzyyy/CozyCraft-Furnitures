import { describe, expect, it } from "vitest";
import { cartProductCount, checkoutQuantityError } from "./checkout-limits";
describe("checkout quantity policy", () => {
  it("counts products, not pieces", () => expect(cartProductCount([{id:"sofa",quantity:5},{id:"chair",quantity:7},{id:"table",quantity:2}])).toBe(3));
  it("accepts inclusive boundaries", () => expect(checkoutQuantityError([{id:"chair",quantity:10},{id:"table",quantity:10}])).toBe(""));
  it("rejects per-product and combined duplicate excess", () => {
    expect(checkoutQuantityError([{id:"a",quantity:11}])).toContain("10 pieces");
    expect(checkoutQuantityError([{id:"a",quantity:6},{id:"a",quantity:5}])).toContain("10 pieces");
  });
  it("rejects too many lines and pieces", () => {
    expect(checkoutQuantityError(Array.from({length:11},(_,n)=>({id:String(n),quantity:1})))).toContain("10 different");
    expect(checkoutQuantityError([{id:"a",quantity:10},{id:"b",quantity:10},{id:"c",quantity:1}])).toContain("20 pieces");
  });
  it.each([NaN,Infinity,0,-1,1.5])("rejects malformed quantity %s", quantity=>expect(checkoutQuantityError([{id:"a",quantity}])).not.toBe(""));
});
