/** Последовательная очередь исходящих сообщений (upload + send). */
export function createOutgoingSendQueue() {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      const next = tail.then(task, task);
      tail = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
  };
}
