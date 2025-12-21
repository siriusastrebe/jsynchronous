type Stand_In = 'object' | 'array';
type Event = 'changes' | 'snapshot';
type Event_Changes_Callback = (data: any) => void;

export type Synchronized_Variable<Variable_Type> = Variable_Type & {
  $on: (event: Event, callback: Event_Changes_Callback) => void;
  $info: () => {
    client_history: boolean
    counter: number
    handshake: true
    history_length: number
    name: string
    one_way: boolean
    resyncs : number
    rewind : boolean
    rewound : boolean
    snapshots : string[]
    standIn : boolean
  };
  $tart: () => void;
  $listeners: () => any[];
  $napshot: (name: string) => void;
  $rewind: (name: string, counter?: number) => void;
  list: () => string[];
  variables: () => { [key]: string, value: Synchronized_Variable<Variable_Type> };
}

declare function jsynchronous<Variable_Type>(standInType: Stand_In, name?: string): Synchronized_Variable<Variable_Type>;

declare namespace jsynchronous {
    export let send: (websocket: any, data: any) => void;
    export const onmessage: (data: any) => void;
}

export default jsynchronous;

// export interface jsynchronous {
//   <Synchronized_Variable>(standInType: Stand_In, name: string) => Synchronized_Type;
//   send: (data: any) => void;
// }
