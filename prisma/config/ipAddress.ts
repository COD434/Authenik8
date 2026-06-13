import {Address4, Address6} from "ip-address";

export const isIpInCidr = (ip: string, cidr: string): boolean => {
if (Address4.isValid(ip) && Address4.isValid(cidr)){
return new Address4(ip).isInSubnet(new Address4(cidr));
}
if (Address6.isValid(ip) && Address4.isValid(cidr)){
const address = new Address6(ip);
return address.is4() && address.to4().isInSubnet(new Address4(cidr));
}
if (Address6.isValid(ip) && Address6.isValid(cidr)){
return new Address6(ip).isInSubnet(new Address6(cidr));
}
return false;
};
