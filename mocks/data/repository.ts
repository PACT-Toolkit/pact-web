type MockRepositoryInstantiator<T> = (overrides: Partial<T>) => T;

type MockPredicate<T> = (item: T) => boolean;

export class MockRepository<T> {
  private items: T[] = [];

  constructor(private instantiator: MockRepositoryInstantiator<T>) {}

  // The instantiator is the sole authority for what fields belong to T --
  // whatever it returns from `overrides` is what gets stored. Unknown keys
  // in `overrides` that the instantiator doesn't map onto T are dropped,
  // not grafted onto the stored item: a store whose rows silently grow
  // fields outside T defeats the type contract Partial<T> is meant to
  // enforce (PACT-582).
  create = (overrides: Partial<T>): T => {
    const item = this.instantiator(overrides);

    this.items.push(item);

    return item;
  };

  update = (
    criteria: MockPredicate<T>,
    mutate: (item: T) => T
  ): T | undefined => {
    let mutated: T | undefined;

    this.items = this.items.map((item) => {
      if (criteria(item)) {
        mutated = mutate(item);

        return mutated;
      }

      return item;
    });

    return mutated;
  };

  delete = (criteria: MockPredicate<T>): void => {
    this.items = this.items.filter((item) => !criteria(item));
  };

  getAll = (): T[] => this.items;

  findFirst = (criteria: MockPredicate<T>): T | undefined =>
    this.items.find(criteria);

  findMany = (criteria: MockPredicate<T>): T[] => this.items.filter(criteria);
}
