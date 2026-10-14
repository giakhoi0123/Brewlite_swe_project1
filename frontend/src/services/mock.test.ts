import test from 'node:test';
import assert from 'node:assert/strict';
import { mockBarista, mockLoyalty, mockOrders, mockPayments, mockPromotions } from './mock';
import { cartTotal, itemKey, lineTotal, type CartItem } from '@/types/domain';
const data = new Map<string,string>();
Object.defineProperty(globalThis,'window',{value:{},configurable:true});
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}},configurable:true});
const item:CartItem={key:itemKey('coffee','M',['cream'],'70% đá','50% ít ngọt'),productId:'coffee',name:'Cà phê sữa',imageUrl:'',size:'M',toppingIds:['cream'],toppingNames:['Kem sữa'],unitPrice:63000,quantity:2,ice:'70% đá',sugar:'50% ít ngọt'};
test('distinct configurations and integer totals',()=>{assert.notEqual(item.key,itemKey('coffee','L',['cream'],'70% đá','50% ít ngọt'));assert.equal(lineTotal(item),126000);assert.equal(cartTotal([item]),126000)});
test('mock order, failure retry, idempotency, paid loyalty and staff lifecycle',async()=>{
 data.clear();const order=await mockOrders.create('customer-1',[item]);assert.equal(order.status,'PENDING');assert.equal(order.total,126000);assert.equal((await mockLoyalty.get('customer-1')).points,0);
 const failed=await mockPayments.pay(order.id,'WALLET','failed-key','PAYMENT_FAILED');assert.equal(failed.status,'PAYMENT_FAILED');assert.equal(await mockOrders.status(order.id),'PAYMENT_FAILED');assert.equal((await mockLoyalty.get('customer-1')).points,0);
 const same=await mockPayments.pay(order.id,'WALLET','failed-key','PAID');assert.deepEqual(same,failed);assert.equal(await mockOrders.status(order.id),'PAYMENT_FAILED');
 const paid=await mockPayments.pay(order.id,'CARD','retry-key','PAID');assert.equal(paid.status,'PAID');assert.equal(await mockOrders.status(order.id),'PAID');assert.equal((await mockLoyalty.get('customer-1')).points,12);
 await assert.rejects(()=>mockPayments.pay(order.id,'CARD','third-key','PAID'));
 await mockBarista.transition(order.id,'PREPARING');await mockBarista.transition(order.id,'READY');await mockBarista.transition(order.id,'COMPLETED');assert.equal(await mockOrders.status(order.id),'COMPLETED');await assert.rejects(()=>mockBarista.transition(order.id,'CANCELLED'));
});
test('unknown result keeps pending; promotion validates input',async()=>{
 data.clear();const order=await mockOrders.create('customer-2',[item]);assert.equal((await mockPayments.pay(order.id,'WALLET','unknown-key','UNKNOWN')).status,'UNKNOWN');assert.equal(await mockOrders.status(order.id),'PENDING');assert.equal((await mockPromotions.validate('BREW10',126000)).discount,10000);await assert.rejects(()=>mockPromotions.validate('INVALID',126000));
});
