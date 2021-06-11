let obj = {
  a: '1',
  b: 2,
  z: {
    z2: 'zaaapo',
    z1: 'zeebes',
    z3: 'zuuupm',
  }
}

const handler = {
  get(obj, prop) {
    console.log('get', prop);
    return obj[prop];
  },
  set(obj, prop, value) {
    console.log('set', prop)
    obj[prop] = value;
    return true;
  }
}

const proxy = new Proxy(obj, handler);
console.log('Value of proxy: ', proxy);

proxy['b'] = 3;
proxy['c'] = 48;
proxy.z.z3 = 'zzzzz';

console.log('logging property \'a\'', proxy['a']);
console.log('Value of proxy: ', proxy);
