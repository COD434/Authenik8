import assert from "node:assert/strict";
import {isIpInCidr} from "../prisma/config/ipAddress";

describe("isIpInCidr", () => {
  it("matches IPv4, IPv6, and IPv4-mapped IPv6 addresses", () => {
    assert.equal(isIpInCidr("192.168.1.42", "192.168.1.0/24"), true);
    assert.equal(isIpInCidr("192.168.2.42", "192.168.1.0/24"), false);
    assert.equal(isIpInCidr("::ffff:192.168.1.42", "192.168.1.0/24"), true);
    assert.equal(isIpInCidr("2001:db8::42", "2001:db8::/32"), true);
    assert.equal(isIpInCidr("2001:db9::42", "2001:db8::/32"), false);
  });

  it("rejects malformed addresses and incompatible address families", () => {
    assert.equal(isIpInCidr("not-an-ip", "192.168.1.0/24"), false);
    assert.equal(isIpInCidr("192.168.1.42", "not-a-cidr"), false);
    assert.equal(isIpInCidr("192.168.1.42", "2001:db8::/32"), false);
  });
});
