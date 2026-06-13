"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIpInCidr = void 0;
const ip_address_1 = require("ip-address");
const isIpInCidr = (ip, cidr) => {
    if (ip_address_1.Address4.isValid(ip) && ip_address_1.Address4.isValid(cidr)) {
        return new ip_address_1.Address4(ip).isInSubnet(new ip_address_1.Address4(cidr));
    }
    if (ip_address_1.Address6.isValid(ip) && ip_address_1.Address4.isValid(cidr)) {
        const address = new ip_address_1.Address6(ip);
        return address.is4() && address.to4().isInSubnet(new ip_address_1.Address4(cidr));
    }
    if (ip_address_1.Address6.isValid(ip) && ip_address_1.Address6.isValid(cidr)) {
        return new ip_address_1.Address6(ip).isInSubnet(new ip_address_1.Address6(cidr));
    }
    return false;
};
exports.isIpInCidr = isIpInCidr;
