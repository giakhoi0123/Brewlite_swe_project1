import test from 'node:test';
import assert from 'node:assert/strict';
import { mockBarista, mockCart, mockLoyalty, mockOrders, mockPayments, mockPromotions } from './mock';
import { cartTotal, itemKey, lineTotal, type CartItem } from '@/types/domain';
const data = new Map<string,string>();
Object.defineProperty(globalThis,'window',{value:{},configurable:true});
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}},configurable:true});
const item:CartItem={key:itemKey('coffee','M',['cream'],'70% đá','50% ít ngọt'),productId:'coffee',name:'Cà phê sữa',imageUrl:'',size:'M',toppingIds:['cream'],toppingNames:['Kem sữa'],unitPrice:63000,quantity:2,ice:'70% đá',sugar:'50% ít ngọt'};
test('distinct configurations and integer totals',()=>{assert.notEqual(item.key,itemKey('coffee','L',['cream'],'70% đá','50% ít ngọt'));assert.equal(lineTotal(item),126000);assert.equal(cartTotal([item]),126000)});
test('mock VNPAY order, idempotency, paid loyalty and staff lifecycle',async()=>{
 data.clear();const order=await mockOrders.create('customer-1',[item]);assert.equal(order.status,'PENDING');assert.equal(order.total,126000);assert.equal((await mockLoyalty.get('customer-1')).points,0);
 const paid=await mockPayments.pay(order.id,'VNPAY_QR','payment-key');assert.equal(paid.status,'PAID');assert.equal(await mockOrders.status(order.id),'PAID');assert.equal((await mockLoyalty.get('customer-1')).points,12);
 const same=await mockPayments.pay(order.id,'VNPAY_QR','payment-key');assert.deepEqual(same,paid);
 await assert.rejects(()=>mockPayments.pay(order.id,'VNPAY_QR','third-key'));
 await mockBarista.transition(order.id,'PREPARING');await mockBarista.transition(order.id,'READY');await mockBarista.transition(order.id,'COMPLETED');assert.equal(await mockOrders.status(order.id),'COMPLETED');await assert.rejects(()=>mockBarista.transition(order.id,'CANCELLED'));
});
test('mock payment rejects retired methods; promotion validates input',async()=>{
 data.clear();const order=await mockOrders.create('customer-2',[item]);await assert.rejects(()=>mockPayments.pay(order.id,'WALLET','wallet-key'),/VNPAY-QR/);assert.equal(await mockOrders.status(order.id),'PENDING');assert.equal((await mockPromotions.validate('BREW10',126000)).discount,10000);await assert.rejects(()=>mockPromotions.validate('INVALID',126000));
});
test('Barista queues exclude unpaid orders, require cancellation reason, and share customer status',async()=>{
 data.clear();
 const unpaid=await mockOrders.create('customer-a',[item]);
 assert.equal(unpaid.status,'PENDING');
 const paid=await mockOrders.create('customer-b',[item]);
 await mockPayments.pay(paid.id,'VNPAY_QR','barista-paid');
 const queue=await mockBarista.list();
 assert.deepEqual(queue.map(order=>order.id),[paid.id]);
 assert.ok(await mockBarista.get(paid.id));
 await assert.rejects(()=>mockBarista.transition(paid.id,'READY'),/không hợp lệ/);
 await assert.rejects(()=>mockBarista.cancel(paid.id,' '),/lý do/);
 const cancelled=await mockBarista.cancel(paid.id,'Hết nguyên liệu');
 assert.equal(cancelled.cancelReason,'Hết nguyên liệu');
 assert.equal((await mockOrders.mine('customer-b'))[0].status,'CANCELLED');
 assert.equal((await mockBarista.list())[0].status,'CANCELLED');
 await assert.rejects(()=>mockBarista.transition(paid.id,'PREPARING'),/không hợp lệ/);
});
test('account cart reprices on the server side, merges configs and enforces stock',async()=>{
 data.clear();const line={productId:'ca-phe-sua',size:'M' as const,toppingIds:['cream'],quantity:2,ice:'70% đá',sugar:'50% ít ngọt'};
 let cart=await mockCart.add('u1',line);assert.equal(cart.items[0].unitPrice,63000);assert.equal(cart.subtotal,126000);
 cart=await mockCart.add('u1',{...line,quantity:1});assert.equal(cart.items.length,1);assert.equal(cart.totalQuantity,3);
 assert.deepEqual((await mockCart.get('u2')).items,[]);
 cart=await mockCart.update('u1',cart.items[0].key,{size:'L'});assert.equal(cart.items[0].unitPrice,70000);
 await assert.rejects(()=>mockCart.update('u1',cart.items[0].key,{quantity:21}),/chỉ còn 20 phần/);
 await assert.rejects(()=>mockCart.add('u1',{...line,productId:'cold-brew-cam'}),/hết hàng/);
 const merged=await mockCart.merge('u1',[{...line,size:'L',quantity:1},{...line,productId:'khong-co'}]);
 assert.equal(merged.items[0].quantity,4);assert.equal(merged.skipped.length,1);
 assert.equal((await mockCart.clear('u1')).items.length,0);
});
