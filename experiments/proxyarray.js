let arr = [
  () => { console.log('I have been logged') },
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
  Math.floor(Math.random() * 100),
]

const handler = {
  get(obj, prop, a, b, c) {
    console.log('get', prop, obj[prop], b, c);
    return obj[prop];
    return false
  },
  set(obj, prop, value) {
    console.log('set', prop, value)
    obj[prop] = value;
    return true;
  },
  deleteProperty(obj, prop) {
    console.log('deleting', obj, prop);
    delete obj[prop];
    return true;
  },
  pop(obj, prop) {
    console.log('popping', obj, prop)
  }
}

const handler2 = {
  get(obj, prop) {
    console.log('get2', prop, obj[prop]);
    return obj[prop];
  },
  set(obj, prop, value) {
    console.log('set2', prop, value)
    obj[prop] = value;
    return true;
  },
  deleteProperty(obj, prop) {
    console.log('deleting2', obj, prop);
    delete obj[prop];
    return true;
  },
  pop(obj, prop) {
    console.log('popping', obj, prop)
  }
}

const proxy = new Proxy(arr, handler);

//const proxy2 = new Proxy(proxy, handler2);

//proxy2.sort();
//proxy2.shift();

//proxy.sort();

console.log('logging 0th element.', proxy[0]());

//proxy.unshift(99);

//proxy.unshift(100);

//proxy.splice(3, 1);

/*
console.log('Value of proxy: ', proxy);
console.log('Value of arr: ', arr);

console.log('logging non-existent property', proxy[99]);

proxy[0] = 3;
proxy[5] = 48;

proxy.push(17);
proxy.push(1234, 5321, 789, 12356);

proxy.splice(2, 0, [11, 12, 13]);
console.log('Value of proxy: ', proxy);
console.log('Value of arr: ', arr);
*/
