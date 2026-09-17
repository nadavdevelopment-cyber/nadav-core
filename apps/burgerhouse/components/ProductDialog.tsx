'use client';

import {useMemo, useState} from 'react';
import type {CartSelection, Product} from '@nadav/core';
import {ProductVisual} from './BrandArtwork';
import {useDialogFocus} from './useDialogFocus';

const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);

export function ProductDialog({product, onClose, onAdd}: {product: Product; onClose: () => void; onAdd: (product: Product, quantity: number, selections: CartSelection[], notes: string) => void}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>(() => Object.fromEntries(product.modifierGroups.map(group => [group.id, group.options.filter(option => option.available).length === 1 && group.min > 0 ? [group.options.find(option => option.available)!.id] : []])));

  const dialogRef = useDialogFocus<HTMLElement>(onClose);

  const valid = product.modifierGroups.every(group => {
    const count = selected[group.id]?.length ?? 0;
    return count >= group.min && count <= group.max;
  });
  const unit = useMemo(() => {
    const extras = product.modifierGroups.reduce((sum, group) => sum + (selected[group.id] ?? []).reduce((groupSum, optionId) => groupSum + (group.options.find(option => option.id === optionId)?.price ?? 0), 0), 0);
    return (product.promotionalPrice ?? product.price) + extras;
  }, [product, selected]);

  function toggle(groupId: string, optionId: string, max: number) {
    setSelected(current => {
      const values = current[groupId] ?? [];
      if (max === 1) return {...current, [groupId]: [optionId]};
      if (values.includes(optionId)) return {...current, [groupId]: values.filter(id => id !== optionId)};
      if (values.length >= max) return current;
      return {...current, [groupId]: [...values, optionId]};
    });
  }

  function add() {
    if (!valid) return;
    const selections = product.modifierGroups.flatMap(group => (selected[group.id] ?? []).map(optionId => ({groupId: group.id, optionId})));
    onAdd(product, quantity, selections, notes.trim());
  }

  return <div className="dialog-layer" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" ref={dialogRef} tabIndex={-1}>
      <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar detalle">×</button>
      <div className="product-dialog__image"><ProductVisual product={product}/></div>
      <div className="product-dialog__content">
        <span className="eyebrow">HECHA AL MOMENTO</span>
        <h2 id="product-dialog-title">{product.name}</h2>
        <p className="product-dialog__description">{product.description}</p>
        {product.modifierGroups.map(group => <fieldset className="modifier-group" key={group.id}>
          <legend><span>{group.name}</span><small>{group.min > 0 ? `Elegí ${group.min}${group.max > group.min ? ` a ${group.max}` : ''}` : `Opcional · hasta ${group.max}`}</small></legend>
          {group.options.filter(option => option.available).map(option => {
            const checked = selected[group.id]?.includes(option.id) ?? false;
            return <label className={checked ? 'modifier-option modifier-option--selected' : 'modifier-option'} key={option.id}>
              <input type={group.max === 1 ? 'radio' : 'checkbox'} name={`modifier-${group.id}`} checked={checked} onChange={() => toggle(group.id, option.id, group.max)}/>
              <span>{option.name}</span><strong>{option.price ? `+ ${money(option.price)}` : 'Sin cargo'}</strong>
            </label>;
          })}
        </fieldset>)}
        <label className="notes-field">¿Algo que tengamos que saber?<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} placeholder="Ej: sin cebolla"/></label>
        {!valid ? <p className="selection-warning" role="alert">Completá las opciones obligatorias para continuar.</p> : null}
        <div className="product-dialog__actions">
          <div className="quantity-control" aria-label="Cantidad">
            <button type="button" onClick={() => setQuantity(value => Math.max(1, value - 1))} aria-label="Restar uno">−</button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" onClick={() => setQuantity(value => Math.min(99, value + 1))} aria-label="Sumar uno">+</button>
          </div>
          <button className="primary-button primary-button--wide" type="button" onClick={add} disabled={!valid}>AGREGAR · {money(unit * quantity)}</button>
        </div>
      </div>
    </section>
  </div>;
}
