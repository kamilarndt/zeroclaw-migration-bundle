import React, { useState, useMemo, useCallback, ChangeEvent } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface SearchFilterProps<T> {
  items: T[];
  onFilteredItemsChange: (items: T[]) => void;
  searchFields?: (keyof T)[];
  filterOptions?: FilterOption<T>[];
  placeholder?: string;
  showCount?: boolean;
}

export interface FilterOption<T> {
  key: string;
  label: string;
  options: {
    label: string;
    value: string;
    predicate: (item: T) => boolean;
  }[];
  multiple?: boolean;
}

function SearchFilter<T>({
  items,
  onFilteredItemsChange,
  searchFields = [],
  filterOptions = [],
  placeholder = 'Search...',
  showCount = true,
}: SearchFilterProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const toggleFilter = useCallback((key: string) => {
    setExpandedFilter(prev => prev === key ? null : key);
  }, []);

  const handleFilterOption = useCallback((key: string, value: string) => {
    setSelectedFilters(prev => {
      const current = prev[key] || [];
      const isActive = current.includes(value);
      
      return {
        ...prev,
        [key]: isActive ? current.filter(v => v !== value) : [...current, value],
      };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedFilters({});
    setExpandedFilter(null);
  }, []);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => {
        if (searchFields.length === 0) {
          // Search all string fields
          return Object.values(item).some(
            value => typeof value === 'string' && value.toLowerCase().includes(query)
          );
        }
        
        // Search only specified fields
        return searchFields.some(field => {
          const value = item[field];
          return typeof value === 'string' && value.toLowerCase().includes(query);
        });
      });
    }

    // Apply filters
    Object.entries(selectedFilters).forEach(([key, values]) => {
      if (values.length === 0) return;

      const filterOption = filterOptions.find(f => f.key === key);
      if (!filterOption) return;

      if (filterOption.multiple) {
        // OR logic for multiple selections
        result = result.filter(item => 
          values.some(value => {
            const option = filterOption.options.find(o => o.value === value);
            return option?.predicate(item);
          })
        );
      } else {
        // Single selection - use first value
        const value = values[0];
        const option = filterOption.options.find(o => o.value === value);
        if (option) {
          result = result.filter(option.predicate);
        }
      }
    });

    return result;
  }, [items, searchQuery, searchFields, selectedFilters, filterOptions]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(selectedFilters).reduce((acc, values) => acc + values.length, 0);
  }, [selectedFilters]);

  // Notify parent of filtered items
  React.useEffect(() => {
    onFilteredItemsChange(filteredItems);
  }, [filteredItems, onFilteredItemsChange]);

  const hasActiveFilters = searchQuery || activeFiltersCount > 0;

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="flex flex-col gap-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={placeholder}
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
          />
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              title="Clear all filters"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Options */}
        {filterOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Filter size={16} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-500/20 rounded-full text-blue-400">
                  {activeFiltersCount}
                </span>
              )}
            </div>

            {filterOptions.map((filter) => (
              <div key={filter.key} className="border border-white/10 rounded-lg">
                <button
                  onClick={() => toggleFilter(filter.key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm font-medium text-white">
                    {filter.label}
                  </span>
                  {expandedFilter === filter.key ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </button>

                {expandedFilter === filter.key && (
                  <div className="px-4 pb-3 pt-2 border-t border-white/10">
                    <div className="flex flex-col gap-2">
                      {filter.options.map((option) => {
                        const isSelected = selectedFilters[filter.key]?.includes(option.value);
                        
                        return (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-2 py-1 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleFilterOption(filter.key, option.value)}
                              className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <span
                              className={`text-sm ${
                                isSelected ? 'text-white' : 'text-gray-400'
                              }`}
                            >
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Results Count */}
        {showCount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {filteredItems.length} of {items.length} items
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchFilter;
