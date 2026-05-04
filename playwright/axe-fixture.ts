import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';

export function makeAxeBuilder(page: Page) {
  return new AxeBuilder({ page })
    .disableRules([
      'heading-order',
      'empty-heading',
      'button-name',
      'color-contrast',
      'aria-allowed-attr',
      'page-has-heading-one',
      'scrollable-region-focusable',
      'landmark-one-main',
      'empty-table-header',
    ])
    .exclude('[aria-labelledby^="_r_"]')
    .exclude('[aria-controls^="radix-"]');
}
