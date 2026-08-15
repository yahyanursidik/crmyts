import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, ChevronDown, Check } from 'lucide-react';
import {
  INDONESIAN_CITIES,
  searchIndonesianCities,
  IndonesianCityItem,
  POPULAR_CITIES,
} from '@/lib/constants/indonesianCities';

interface CitySuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  showPopularChips?: boolean;
}

export function CitySuggestInput({
  value,
  onChange,
  placeholder = 'Ketik nama kota atau kabupaten domisili...',
  required = false,
  disabled = false,
  className = '',
  id,
  name,
  showPopularChips = true,
}: CitySuggestInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<IndonesianCityItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update suggestions whenever value changes
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      // If empty, show top popular cities as suggestions
      const defaultSuggestions = INDONESIAN_CITIES.filter((c) => c.popular).slice(0, 8);
      setSuggestions(defaultSuggestions);
    } else {
      const results = searchIndonesianCities(value, 8);
      setSuggestions(results);
    }
    setHighlightedIndex(-1);
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCity = (cityText: string) => {
    onChange(cityText);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        const chosen = suggestions[highlightedIndex];
        if (chosen) {
          handleSelectCity(`${chosen.name}, ${chosen.province}`);
        }
      } else if (suggestions.length === 1 && suggestions[0]) {
        e.preventDefault();
        const chosen = suggestions[0];
        handleSelectCity(`${chosen.name}, ${chosen.province}`);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearValue = () => {
    onChange('');
    inputRef.current?.focus();
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <MapPin className="w-3.5 h-3.5" />
        </div>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className={`w-full pl-9 pr-14 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-all ${
            disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900'
          } ${className}`}
        />

        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={clearValue}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              title="Hapus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            disabled={disabled}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 max-h-64 flex flex-col">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>{value.trim() ? 'Rekomendasi Kota / Kabupaten' : 'Paling Sering Dipilih'}</span>
            <span className="text-[10px] font-normal text-slate-400">
              {suggestions.length} hasil ditemukan
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 py-1">
            {suggestions.length > 0 ? (
              suggestions.map((item, idx) => {
                const fullCityText = `${item.name}, ${item.province}`;
                const isSelected = value.toLowerCase() === fullCityText.toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={`${item.name}-${item.province}`}
                    type="button"
                    onClick={() => handleSelectCity(fullCityText)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                      isHighlighted || isSelected
                        ? 'bg-teal-50 text-teal-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-teal-700' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">
                        <b className="text-slate-900">{item.name}</b>,{' '}
                        <span className="text-slate-500 font-normal">{item.province}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
                        {item.type}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-teal-700" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-700">Tidak ada saran kota yang persis sama</p>
                <p className="text-[11px] text-slate-500">
                  Anda tetap dapat menggunakan teks "<b>{value}</b>" yang Anda ketik.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popular Quick-Select Chips (Optional) */}
      {showPopularChips && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] font-bold text-slate-400">Pilihan Cepat:</span>
          {POPULAR_CITIES.slice(0, 4).map((city) => {
            const shortName = city.split(',')[0] || city;
            const isMatch = value.toLowerCase().includes(shortName.toLowerCase());
            return (
              <button
                key={city}
                type="button"
                onClick={() => handleSelectCity(city)}
                className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                  isMatch
                    ? 'bg-teal-100 text-teal-900 border-teal-300 font-bold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {shortName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
