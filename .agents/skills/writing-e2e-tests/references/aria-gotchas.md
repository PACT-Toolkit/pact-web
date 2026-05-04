# ARIA Attribute Gotchas

Load this when asserting on disabled / selected / pressed / invalid state.

Several components in this app expose semantic state through ARIA attributes rather than native HTML props. Asserting on the wrong attribute produces silent passes.

## Disabled

Some components use `aria-disabled` instead of the HTML `disabled` attribute:

```ts
await expect(locator).toHaveAttribute('aria-disabled', 'true');
```

## Toggle state

- `aria-pressed` — toggle chips and toggle buttons.
- `aria-invalid` — form fields in error state.

## matter-web `Choice` (single `ChoiceGroup`)

Renders as a Radix radio button. The Radix `data-state` value is `"on"` / `"off"` — **not** `"checked"` / `"unchecked"` (those belong to Checkbox / Switch). Use `aria-checked` to assert selection state — it's the stable semantic attribute and survives Radix internal renames:

```ts
await expect(page.getByTestId('my-choice-reason')).toHaveAttribute('aria-checked', 'true');
```

## Radix Checkbox / Switch

Use `data-state="checked"` / `data-state="unchecked"`:

```ts
await expect(page.getByTestId('checkbox').locator('[data-state="checked"]')).toBeAttached();
```
