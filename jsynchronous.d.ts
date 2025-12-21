type Event_Changes_Callback = (data: any) => void;

export type Synchronized_Variable<Variable_Type> = Variable_Type & {
  $on: (event: Event, callback: Event_Changes_Callback) => void;
  $ync: (websocket: any) => void;
  $unsync: (websocket: any) => void;
}

export type JysnchronousOptions = {
  rewind?: boolean;
  one_way?: boolean;
  send?: (websocket: any, data: any) => void;
  buffer_time?: number;
  client_history?: number;
  history_limit?: number;
  wait?: boolean;
  $ync?: string;
  $unsync?: string;
  $on?: string;
  $tart?: string;
  $listeners?: string;
  $info?: string;
  $napshot?: string;
  $rewind?: string;
  $copy?: string;
}

export type Jsynchronous = {
  <Variable_Type>(initialVariable: Variable_Type, name?: string, options?: JsynchronousOptions): Synchronized_Variable<Variable_Type>;
  send: (websocket: any, data: any) => void;
  onmessage: (websocket: any, data: any) => void;
  list: () => string[];
  variables: () => { [key: string]: Synchronized_Variable<Variable_Type> };
  pausegc: () => void;
  resumegc: () => void;
  rungc: () => void;
}

declare const jsynchronous: Jsynchronous;

export default jsynchronous;
