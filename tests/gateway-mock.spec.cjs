const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('gateway: endpoint intention present',()=>{expect(html).toContain('PAYMENT_GATEWAY_URL+"/intent"')});
test('gateway: garde-fou tarifs proprietaires present',()=>{expect(html).toContain('validateOwnerTariffAndSchedule()')});
test('gateway: garde-fou multi passages B2B present',()=>{expect(html).toContain('validateB2BMultiBeforeGateway()')});
test('gateway: garde-fou coherence mission VOIR present',()=>{expect(html).toContain('assertVoirContractInvariant()')});
test('gateway: protection hors secteur present',()=>{expect(html).toContain('zoneCoverage()!=="INCLUS"')});
