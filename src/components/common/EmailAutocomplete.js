'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail } from 'lucide-react';

/**
 * Email Autocomplete Component
 * Searches for existing users as you type an email
 * Allows selecting from available users
 */
export function EmailAutocomplete({
  value,
  onChange,
  onSelectUser,
  placeholder = 'Enter email address',
  className = '',
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);

  // Search for users as you type
  useEffect(() => {
    if (!value || value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/search?search=${encodeURIComponent(value)}&limit=10`);
        const data = await response.json();

        if (data.success) {
          setSuggestions(data.data);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300); // Debounce
    return () => clearTimeout(timer);
  }, [value]);

  const handleSelect = (user) => {
    onChange(user.email);
    onSelectUser?.(user);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => value && suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />

      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10"
          >
            <div className="max-h-64 overflow-y-auto">
              {suggestions.map((user, index) => (
                <motion.button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                    selectedIndex === index
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Mail size={16} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{user.full_name}</div>
                    <div className="text-sm opacity-75 truncate">{user.email}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && value.length >= 2 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        </div>
      )}
    </div>
  );
}
