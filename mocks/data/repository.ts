type MockRepositoryInstantiator<T> = (overrides: Partial<T>) => T;

type MockPredicate<T> = (item: T) => boolean;

export class MockRepository<T> {
  private items: T[] = [];

  constructor(private instantiator: MockRepositoryInstantiator<T>) {}

  create = (overrides: Partial<T>): T => {
    const item = this.instantiator(overrides);

    Object.keys(overrides).forEach(key => {
      if (
        !(key in (item as object)) &&
        (overrides as Record<string, unknown>)[key] !== undefined
      ) {
        (item as Record<string, unknown>)[key] = (overrides as Record<string, unknown>)[key];
      }
    });

    this.items.push(item);

    return item;
  };

  update = (criteria: MockPredicate<T>, mutate: (item: T) => T): T | undefined => {
    let mutated: T | undefined;

    this.items = this.items.map(item => {
      if (criteria(item)) {
        mutated = mutate(item);

        return mutated;
      }

      return item;
    });

    return mutated;
  };

  delete = (criteria: MockPredicate<T>): void => {
    this.items = this.items.filter(item => !criteria(item));
  };

  getAll = (): T[] => this.items;

  findFirst = (criteria: MockPredicate<T>): T | undefined => this.items.find(criteria);

  findMany = (criteria: MockPredicate<T>): T[] => this.items.filter(criteria);
}
