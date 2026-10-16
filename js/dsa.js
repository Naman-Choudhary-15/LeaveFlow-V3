// DSA layer: Linked List, Queue and Stack
class LeaveNode {
  constructor(data){ this.data=data; this.next=null; }
}
class LeaveLinkedList {
  constructor(){ this.head=null; this.size=0; }
  append(data){
    const node=new LeaveNode(data);
    if(!this.head)this.head=node;
    else{let c=this.head;while(c.next)c=c.next;c.next=node;}
    this.size++; return node.data;
  }
  toArray(){const a=[];let c=this.head;while(c){a.push(c.data);c=c.next}return a}
  findById(id){let c=this.head;while(c){if(c.data.id===Number(id))return c.data;c=c.next}return null}
  deleteById(id){
    id=Number(id);let c=this.head,p=null;
    while(c){if(c.data.id===id){if(p)p.next=c.next;else this.head=c.next;this.size--;return true}p=c;c=c.next}
    return false;
  }
}
class LeaveQueue {
  constructor(){this.items=[]}
  enqueue(item){this.items.push(item)}
  dequeue(){return this.items.shift()}
  peek(){return this.items[0]||null}
  toArray(){return [...this.items]}
}
class HistoryStack {
  constructor(){this.items=[]}
  push(item){this.items.push(item)}
  pop(){return this.items.pop()}
  toArray(){return [...this.items].reverse()}
}
function linearSearch(records, query){
  query=String(query).toLowerCase();
  for(const r of records) if(String(r.id)===query || String(r.name||"").toLowerCase().includes(query) || String(r.roll_no ?? r.rollNo ?? "").toLowerCase().includes(query)) return r;
  return null;
}
function bubbleSort(records, key="id"){
  const a=records.map(x=>({...x}));
  for(let i=0;i<a.length-1;i++) for(let j=0;j<a.length-i-1;j++)
    if(String(a[j][key]).localeCompare(String(a[j+1][key]),undefined,{numeric:true})>0){const t=a[j];a[j]=a[j+1];a[j+1]=t}
  return a;
}

