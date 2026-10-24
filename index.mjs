import * as sdk from '@stellar/stellar-sdk';
import {createHash} from 'node:crypto';
export const NETWORK=sdk.Networks.TESTNET;
const sha=b=>createHash('sha256').update(b).digest('hex');
const assert=(v,m)=>{if(!v)throw Error(m)};
export function decodeKey(raw){
 assert(typeof raw==='string'&&raw.length>0&&raw.length<16384&&/^[A-Za-z0-9+/]+={0,2}$/.test(raw),'Invalid base64 ledger key');
 const bytes=Buffer.from(raw,'base64');assert(bytes.toString('base64')===raw,'Noncanonical base64 ledger key');
 const key=sdk.xdr.LedgerKey.fromXDR(bytes);assert(Buffer.from(key.toXDR()).equals(bytes),'Noncanonical ledger key XDR');
 const type=key.type;let freezable=['account','trustline','contractData','contractCode'].includes(type),reason='';
 if(type==='trustline'){
  const t=key.value,asset=t.asset,kind=asset.type;
  if(kind==='assetTypePoolShare'){freezable=false;reason='Pool-share trustlines cannot be frozen by CAP-77'}
  else if(['assetTypeCreditAlphanum4','assetTypeCreditAlphanum12'].includes(kind)){
   const issuer=kind==='assetTypeCreditAlphanum4'?asset.value.issuer:asset.value.issuer;
   if(Buffer.from(issuer.toXDR()).equals(Buffer.from(t.accountId.toXDR()))){freezable=false;reason='Issuer trustlines are not real ledger entries'}
  }else{freezable=false;reason='Unsupported trustline asset'}
 }
 if(!freezable&&!reason)reason='CAP-77 does not support freezing '+type;
 return {id:sha(bytes),xdr:raw,type,freezable,reason};
}
function uniqueKeys(keys){assert(Array.isArray(keys)&&keys.length<=1000,'Expected at most 1000 keys');return [...new Map(keys.map(k=>{const d=decodeKey(k);assert(d.freezable,d.reason);return [d.id,d]})).values()]}
function hashes(xs){assert(Array.isArray(xs)&&xs.length<=1000&&xs.every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)),'Invalid transaction content hash list');return [...new Set(xs)]}
export function normalizeSnapshot(s){
 assert(s&&s.schemaVersion===1&&s.network==='testnet','Only schema 1 testnet snapshots supported');
 assert(Number.isInteger(s.ledger)&&s.ledger>=0&&s.ledger<=4294967295,'Invalid ledger');
 assert(Number.isInteger(s.protocolVersion)&&s.protocolVersion>=26,'CAP-77 requires protocol 26 or later');
 return {...s,frozenKeys:uniqueKeys(s.frozenKeys),bypassHashes:hashes(s.bypassHashes)};
}
export function applyProposal(snapshot,delta){
 const s=normalizeSnapshot(snapshot);assert(delta&&typeof delta==='object','Proposal required');
 const add=uniqueKeys(delta.freeze),remove=uniqueKeys(delta.unfreeze),addHashes=hashes(delta.addBypass),removeHashes=hashes(delta.removeBypass);
 const overlap=add.filter(a=>remove.some(b=>a.id===b.id));assert(!overlap.length,'Ambiguous proposal: same key in freeze and unfreeze');
 assert(!addHashes.some(h=>removeHashes.includes(h)),'Ambiguous proposal: same bypass hash added and removed');
 const m=new Map(s.frozenKeys.map(k=>[k.id,k]));const ignoredAdds=[],ignoredRemoves=[];
 for(const k of add){if(m.has(k.id))ignoredAdds.push(k.id);m.set(k.id,k)}
 for(const k of remove){if(!m.delete(k.id))ignoredRemoves.push(k.id)}
 const b=new Set(s.bypassHashes);for(const h of addHashes)b.add(h);for(const h of removeHashes)b.delete(h);
 const next={...snapshot,frozenKeys:[...m.values()].map(k=>k.xdr),bypassHashes:[...b]};
 return {snapshot:next,added:add.filter(k=>!s.frozenKeys.some(x=>x.id===k.id)),removed:remove.filter(k=>s.frozenKeys.some(x=>x.id===k.id)),ignoredAdds,ignoredRemoves,scope:'Local counterfactual only; no configuration upgrade submitted'};
}
// M-addresses normalize through SDK decodeMuxedAccount for exact underlying account identity.
function baseAccount(id){if(id.startsWith('M'))return sdk.StrKey.encodeEd25519PublicKey(sdk.decodeAddressToMuxedAccount(id).value.ed25519.toBytes());return id}
function accountXdr(id){return sdk.xdr.LedgerKey.account(new sdk.xdr.LedgerKeyAccount({accountId:sdk.Keypair.fromPublicKey(baseAccount(id)).xdrAccountId()})).toXDR('base64')}
function balanceXdr(id,asset){if(asset.isNative())return accountXdr(id);if(baseAccount(id)===asset.getIssuer())return null;return sdk.xdr.LedgerKey.trustline(new sdk.xdr.LedgerKeyTrustLine({accountId:sdk.Keypair.fromPublicKey(baseAccount(id)).xdrAccountId(),asset:asset.toTrustLineXDRObject()})).toXDR('base64')}
export function inspectEnvelope(envelopeXdr,snapshot){
 const s=normalizeSnapshot(snapshot);assert(typeof envelopeXdr==='string'&&envelopeXdr.length<=150000,'Envelope too large');
 const outer=sdk.TransactionBuilder.fromXDR(envelopeXdr,NETWORK),isFeeBump=!!outer.innerTransaction,tx=outer.innerTransaction||outer;
 const hash=Buffer.from(outer.hash()).toString('hex'),frozen=new Map(s.frozenKeys.map(k=>[k.id,k])),accesses=[],unknown=[],applyTime=[];
 function access(raw,reason){if(!raw)return;const k=decodeKey(raw);accesses.push({...k,reason,frozen:frozen.has(k.id)})}
 access(accountXdr(tx.source),'Transaction source account');if(isFeeBump)access(accountXdr(outer.feeSource),'Fee-bump source account');
 tx.operations.forEach((op,i)=>{
  const src=op.source||tx.source;access(accountXdr(src),`Operation ${i+1} source account`);
  if(op.type==='payment'){access(balanceXdr(src,op.asset),`Payment ${i+1} source balance`);access(balanceXdr(op.destination,op.asset),`Payment ${i+1} destination balance`)}
  else if(op.type==='createAccount')access(accountXdr(op.destination),'Create-account destination');
  else if(op.type==='accountMerge')access(accountXdr(op.destination),'Merge destination');
  else if(op.type==='invokeHostFunction'||op.type==='extendFootprintTtl'||op.type==='restoreFootprint'){
   const data=tx.toEnvelope().value.tx.ext.value;assert(data,'Soroban resource data missing');const fp=data.resources.footprint;
   for(const k of fp.readOnly)access(k.toXDR('base64'),'Soroban read-only footprint');for(const k of fp.readWrite)access(k.toXDR('base64'),'Soroban read-write footprint');
  }else if(['claimClaimableBalance','liquidityPoolDeposit','liquidityPoolWithdraw'].includes(op.type))applyTime.push({operation:i+1,type:op.type,reason:'Opaque asset resolution requires apply-time ledger state; bypass does not override these checks'});
  else unknown.push({operation:i+1,type:op.type,reason:'Operation-specific accesses not implemented; source-account check only'});
 });
 const hits=accesses.filter(a=>a.frozen),bypass=s.bypassHashes.includes(hash);
 const verdict=hits.length&&!bypass?'VALIDATION_BLOCKED':unknown.length||applyTime.length?'INCOMPLETE':hits.length?'BYPASS_LISTED':'NO_MODELED_HIT';
 return {schemaVersion:1,network:'testnet',ledger:s.ledger,contentHash:hash,isFeeBump,verdict,bypass,accesses,hits,unknown,applyTime,
  limitations:['Checks CAP-77 modeled accesses only, not signatures, balances, sequence, fees, or full transaction validity.','No modeled hit is not approval to submit.','DEX matching, sponsored-entry deletion and other apply-time effects are not simulated.','A bypass entry grants validation-stage access only; it does not sign or authorize the transaction.']};
}
export function compare(envelopes,snapshot,proposal){assert(Array.isArray(envelopes)&&envelopes.length>0&&envelopes.length<=100,'Expected 1–100 envelopes');const p=applyProposal(snapshot,proposal);return {schemaVersion:1,proposal:p,transactions:envelopes.map((e,i)=>({id:e.id||String(i+1),before:inspectEnvelope(e.xdr,snapshot),after:inspectEnvelope(e.xdr,p.snapshot)}))}}
export {sdk};
