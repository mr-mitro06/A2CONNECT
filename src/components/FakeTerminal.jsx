import React from 'react';

export default function FakeTerminal() {
  return (
    <div className="fixed inset-0 z-[9990] bg-black text-green-500 font-mono p-4 overflow-hidden selection:bg-green-500/30">
      <div className="opacity-80">
        <p>Linux shadow-terminal 6.1.0-13-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.55-1 (2023-09-23) x86_64</p>
        <p className="mt-2 text-white/50">The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the individual files in /usr/share/doc/*/copyright.</p>
        <p className="mt-4">Last login: {new Date().toUTCString()} from 192.168.1.104</p>
        <div className="mt-4 flex flex-col gap-1">
          <div className="flex">
            <span className="text-green-500 font-bold">admin@shadow-server</span>
            <span className="text-white">:</span>
            <span className="text-blue-400">~</span>
            <span className="text-white">$</span>
            <span className="ml-2 animate-pulse bg-green-500 w-2.5 h-5 inline-block"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
