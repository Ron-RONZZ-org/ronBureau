export function useDatetime() {
  const formatDatetime = (date: Date | string, format: string = 'ISO'): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    switch (format) {
      case 'ISO':
        return d.toISOString();
      case 'Local':
        return d.toLocaleString();
      case 'Date':
        return d.toLocaleDateString();
      case 'Time':
        return d.toLocaleTimeString();
      case 'US':
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      case 'EU':
        return d.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      case 'Short':
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      default:
        return d.toISOString();
    }
  };

  const formatOptions = [
    { value: 'ISO', label: 'ISO 8601 (Default)' },
    { value: 'Local', label: 'Local Format' },
    { value: 'US', label: 'US Format (Month Day, Year)' },
    { value: 'EU', label: 'EU Format (Day Month Year)' },
    { value: 'Short', label: 'Short Format' },
  ];

  return {
    formatDatetime,
    formatOptions,
  };
}
