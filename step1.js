const fs = require('fs');
let content = fs.readFileSync('src/components/PhotoEditorModal.tsx', 'utf8');

// We need to build a custom Autocomplete for tagging.
// First, we add some state for the custom autocomplete.
content = content.replace(
  /const \[personInput, setPersonInput\] = useState\(""\);/,
  `const [personInput, setPersonInput] = useState("");
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);`
);

// We need a handlePersonSelect function
content = content.replace(
  /const handleTagPerson = async \(\) => \{/,
  `const handlePersonSelect = async (personName: string) => {
    setPersonInput(personName);
    setShowPersonSuggestions(false);
    // Directly tag
    await handleTagPerson(personName);
  };

  const handleTagPerson = async (overrideName?: string) => {
    const nameToTag = overrideName || personInput.trim();
    if (!nameToTag) return;
    setIsTaggingPerson(true);
    try {
      const res = await fetch("/api/people/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photo.id,
          personName: nameToTag,
        }),
      });
      const data = await res.json();
      if (data.success && data.personName) {
        setTaggedPeople((prev) => [...prev, { id: data.personId, name: data.personName }]);
        setPersonInput("");
      }
    } catch (e) {
      console.error("Failed to tag person:", e);
    } finally {
      setIsTaggingPerson(false);
    }
  };
  
  // Disable old handleTagPerson code
  const oldHandleTagPerson = async () => {`
);

// We need to replace the body of the old handleTagPerson. Actually, wait. I shouldn't leave broken syntax.
